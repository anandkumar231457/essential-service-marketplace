import { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  identifyCategory,
  findNearbyProviders,
  createAndBroadcastBooking,
  getBookingStatus,
  cancelBooking,
  NearbyProviderInfo,
} from './agentTools.js';

export interface AssistantContext {
  category?: {
    id: number;
    name: string;
  };
  problemDescription?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
  scheduledAt?: string;
  nearbyProviders?: NearbyProviderInfo[];
  readyForConfirmation?: boolean;
  lastBookingId?: string;
}

export interface AssistantResponse {
  message: string;
  context: AssistantContext;
  action?: 'REQUEST_LOCATION' | 'SHOW_NEARBY' | 'CONFIRM_JOB' | 'JOB_CREATED' | 'JOB_STATUS' | 'JOB_CANCELLED';
  data?: any;
  quickReplies?: string[];
}

/** Pluralise "professional" correctly */
function pluralPros(count: number): string {
  return count === 1 ? '1 professional' : `${count} professionals`;
}

export async function chat(req: Request, res: Response) {
  try {
    const user = res.locals.user;
    const {
      message = '',
      context = {} as AssistantContext,
      locationUpdate,
    } = req.body;

    const lower = message.trim().toLowerCase();
    const updatedContext: AssistantContext = { ...context };

    // ── 0. Location update payload handling (<10ms) ──────────────────────────
    if (locationUpdate?.lat && locationUpdate?.lng) {
      updatedContext.location = {
        lat: locationUpdate.lat,
        lng: locationUpdate.lng,
        address: locationUpdate.address || `GPS (${locationUpdate.lat.toFixed(4)}, ${locationUpdate.lng.toFixed(4)})`,
      };

      const categoryName = updatedContext.category?.name;
      const providers = await findNearbyProviders(locationUpdate.lat, locationUpdate.lng, categoryName, 25);
      updatedContext.nearbyProviders = providers;
      updatedContext.readyForConfirmation = Boolean(updatedContext.category);

      if (updatedContext.category) {
        const count = providers.length;
        const prosLabel = pluralPros(count);
        const categoryLabel = updatedContext.category.name;
        return res.json({
          message: count > 0
            ? `📍 Location confirmed.\n\nI found **${prosLabel}** available for **${categoryLabel}** near you. Would you like to request their service?`
            : `📍 Location confirmed.\n\nUnfortunately, there are no available professionals for **${categoryLabel}** in your area right now. Would you like to try a different service?`,
          context: updatedContext,
          action: 'CONFIRM_JOB',
          data: {
            categoryName: categoryLabel,
            problemDescription: updatedContext.problemDescription,
            location: updatedContext.location,
            nearbyCount: count,
            specialists: providers.slice(0, 3),
          },
          quickReplies: count > 0
            ? ['Confirm Service Request', 'Change Service', 'Cancel']
            : ['Try Another Service', 'Cancel'],
        });
      }

      return res.json({
        message: `📍 Location confirmed. What service do you need help with?`,
        context: updatedContext,
        quickReplies: ['Plumber', 'Electrician', 'AC Technician', 'Cleaner'],
      });
    }

    // ── 1. Fast Path for Confirmation / Post Job (<50ms) ──────────────────────
    const isConfirm =
      (lower === 'yes' ||
        lower.startsWith('yes') ||
        lower.includes('confirm') ||
        lower.includes('post job') ||
        lower.includes('proceed') ||
        lower.includes('broadcast') ||
        lower.includes('book now')) &&
      updatedContext.category &&
      updatedContext.location;

    if (isConfirm && updatedContext.category && updatedContext.location) {
      if (!user) {
        return res.json({
          message: 'Please sign in or create an account so we can link your service request to your profile and notify you when a professional accepts.',
          context: updatedContext,
          quickReplies: ['Sign In', 'Create Account'],
        });
      }

      // Pass the pre-found provider count so the confirmation message stays consistent
      const confirmedNearbyCount = updatedContext.nearbyProviders?.length;

      const result = await createAndBroadcastBooking(user.userId, {
        categoryId: updatedContext.category.id,
        description: updatedContext.problemDescription || `${updatedContext.category.name} service requested`,
        address: updatedContext.location.address,
        lat: updatedContext.location.lat,
        lng: updatedContext.location.lng,
        scheduledAt: updatedContext.scheduledAt,
        confirmedNearbyCount,
      });

      updatedContext.lastBookingId = result.booking.id;
      updatedContext.readyForConfirmation = false;

      const count = result.nearbyCount;
      const prosLabel = pluralPros(count);
      const categoryLabel = result.booking.category.name;

      return res.json({
        message: `🎉 **Service Request Confirmed!**\n\nYour ${categoryLabel} request has been sent to **${prosLabel}** nearby. You'll be notified as soon as a professional accepts.`,
        context: updatedContext,
        action: 'JOB_CREATED',
        data: {
          bookingId: result.booking.id,
          bookingCode: result.bookingCode,
          categoryName: categoryLabel,
          address: result.booking.address,
          nearbyCount: count,
        },
        quickReplies: ['🗺️ Track Service', 'Check Order Status', 'Done'],
      });
    }

    // ── 2. Fast Path for Status Check (<50ms) ─────────────────────────────────
    const isStatus =
      lower.includes('status') ||
      lower.includes('track') ||
      lower.includes('where is my') ||
      lower.includes('update on my') ||
      lower.includes('#fin-') ||
      (lower.startsWith('fin-') && lower.length < 15);

    if (isStatus && !lower.includes('cancel')) {
      if (!user) {
        return res.json({
          message: 'To check your service request status, please log in to your FixItNow account.',
          context: updatedContext,
          quickReplies: ['Log In', 'Request New Service'],
        });
      }

      const matchId = message.match(/#?FIN-?([A-Za-z0-9]+)/i);
      const bookingId = matchId ? matchId[1] : updatedContext.lastBookingId;

      const booking = await getBookingStatus(user.userId, bookingId);
      if (!booking) {
        return res.json({
          message: bookingId
            ? `I couldn't find a booking matching #${bookingId}. Please double-check your booking reference.`
            : "You don't have any active service requests right now. Would you like to book a new service?",
          context: updatedContext,
          quickReplies: ['Book New Service', 'View My Bookings'],
        });
      }

      updatedContext.lastBookingId = booking.id;
      const code = `FIN-${booking.id.slice(-6).toUpperCase()}`;
      const statusText =
        booking.status === 'REQUESTED'
          ? 'Looking for a nearby professional (Waiting for acceptance)'
          : booking.status === 'ACCEPTED'
          ? `Accepted by ${booking.provider?.name || 'a professional'}`
          : booking.status === 'EN_ROUTE'
          ? `${booking.provider?.name || 'Your professional'} is on the way`
          : booking.status === 'IN_PROGRESS'
          ? 'Work is currently in progress'
          : booking.status === 'COMPLETED'
          ? 'Completed'
          : booking.status;

      return res.json({
        message: `📋 Booking **#${code}** for ${booking.category.name} is currently **${statusText}** at ${booking.address}.`,
        context: updatedContext,
        action: 'JOB_STATUS',
        data: {
          bookingId: booking.id,
          bookingCode: code,
          categoryName: booking.category.name,
          status: booking.status,
          address: booking.address,
          providerName: booking.provider?.name,
          canCancel: ['REQUESTED', 'ACCEPTED', 'EN_ROUTE'].includes(booking.status),
        },
        quickReplies: ['🗺️ Track Service', 'Cancel This Booking', 'Book Another Service'],
      });
    }

    // ── 3. Fast Path for Cancellation (<50ms) ─────────────────────────────────
    const isCancel =
      lower.includes('cancel') &&
      (lower.includes('job') || lower.includes('booking') || lower.includes('order') || lower.includes('#fin-') || lower.includes('request') || lower.includes('yes'));

    if (isCancel) {
      if (!user) {
        return res.json({
          message: 'Please log in to cancel an existing service booking.',
          context: updatedContext,
          quickReplies: ['Log In', 'Go to Home'],
        });
      }

      const matchId = message.match(/#?FIN-?([A-Za-z0-9]+)/i);
      const bookingId = matchId ? matchId[1] : updatedContext.lastBookingId;

      if (!bookingId) {
        const latest = await getBookingStatus(user.userId);
        if (!latest || !['REQUESTED', 'ACCEPTED', 'EN_ROUTE'].includes(latest.status)) {
          return res.json({
            message: 'You have no active service requests that can be cancelled at the moment.',
            context: updatedContext,
            quickReplies: ['Book New Service', 'Check Booking History'],
          });
        }
        updatedContext.lastBookingId = latest.id;
        return res.json({
          message: `Are you sure you want to cancel your active request for **${latest.category.name}** (Ref: #FIN-${latest.id.slice(-6).toUpperCase()})?`,
          context: updatedContext,
          quickReplies: [`Yes, cancel #FIN-${latest.id.slice(-6).toUpperCase()}`, 'Keep My Booking'],
        });
      }

      const result = await cancelBooking(user.userId, bookingId, 'Cancelled by customer');
      if (!result.success) {
        return res.json({
          message: `⚠️ Unable to cancel: ${result.error}`,
          context: updatedContext,
          quickReplies: ['Check Status', 'Book New Service'],
        });
      }

      return res.json({
        message: `✓ Booking **#${bookingId}** has been successfully cancelled. No charges have been applied.`,
        context: updatedContext,
        action: 'JOB_CANCELLED',
        data: { bookingId },
        quickReplies: ['Book a New Service', 'Back to Home'],
      });
    }

    // ── 4. Fast Category Match for Service Inquiries (<10ms) ──────────────────
    const quickCategory = await identifyCategory(message);
    if (quickCategory) {
      updatedContext.category = {
        id: quickCategory.categoryId,
        name: quickCategory.categoryName,
      };
      if (!updatedContext.problemDescription) {
        updatedContext.problemDescription = message;
      }

      if (updatedContext.location?.lat && updatedContext.location?.lng) {
        const providers = await findNearbyProviders(
          updatedContext.location.lat,
          updatedContext.location.lng,
          quickCategory.categoryName,
          25
        );
        updatedContext.nearbyProviders = providers;
        updatedContext.readyForConfirmation = true;

        const count = providers.length;
        const prosLabel = pluralPros(count);

        return res.json({
          message: count > 0
            ? `I found **${prosLabel}** available for **${quickCategory.categoryName}** near you. Would you like to request their service?`
            : `I couldn't find any available professionals for **${quickCategory.categoryName}** near your location right now. Would you like to try a different service?`,
          context: updatedContext,
          action: 'CONFIRM_JOB',
          data: {
            categoryName: quickCategory.categoryName,
            problemDescription: updatedContext.problemDescription,
            location: updatedContext.location,
            nearbyCount: count,
            specialists: providers.slice(0, 3),
          },
          quickReplies: count > 0
            ? ['Confirm Service Request', 'Cancel']
            : ['Try Another Service', 'Cancel'],
        });
      }

      return res.json({
        message: `I can help with that! To find available **${quickCategory.categoryName}** professionals near you, please share your service location.`,
        context: updatedContext,
        action: 'REQUEST_LOCATION',
        quickReplies: ['📍 Share My Location', 'Bengaluru, KA', 'Puducherry, PY', 'Chennai, TN'],
      });
    }

    // ── 5. Location by City/Place name in message text ─────────────────────────
    if (lower.includes('puducherry') || lower.includes('bengaluru') || lower.includes('bangalore') || lower.includes('san francisco') || lower.includes('chennai')) {
      const isPuducherry = lower.includes('puducherry') || lower.includes('pondicherry');
      const isBlr = lower.includes('bengaluru') || lower.includes('bangalore');
      const lat = isPuducherry ? 11.9401 : isBlr ? 12.9716 : 37.7749;
      const lng = isPuducherry ? 79.8343 : isBlr ? 77.5946 : -122.4194;
      const addr = isPuducherry ? 'Grand Bazaar, Puducherry, India' : isBlr ? 'Koramangala, Bengaluru, India' : 'San Francisco, CA, USA';

      updatedContext.location = { lat, lng, address: addr };
      const providers = await findNearbyProviders(lat, lng, updatedContext.category?.name, 25);
      updatedContext.nearbyProviders = providers;

      if (updatedContext.category) {
        const count = providers.length;
        const prosLabel = pluralPros(count);
        return res.json({
          message: count > 0
            ? `Location set to **${addr}**. I found **${prosLabel}** available for **${updatedContext.category.name}**. Ready to send the request?`
            : `Location set to **${addr}**. Unfortunately no professionals are available for **${updatedContext.category.name}** in this area right now.`,
          context: updatedContext,
          action: 'CONFIRM_JOB',
          data: {
            categoryName: updatedContext.category.name,
            problemDescription: updatedContext.problemDescription,
            location: updatedContext.location,
            nearbyCount: count,
            specialists: providers.slice(0, 3),
          },
          quickReplies: count > 0 ? ['Confirm Service Request', 'Cancel'] : ['Try Another Service', 'Cancel'],
        });
      }

      return res.json({
        message: `Location set to **${addr}**. What service do you need? (e.g. leaking tap, AC repair, electrical work)`,
        context: updatedContext,
        quickReplies: ['Plumber needed', 'Electrician needed', 'AC repair', 'Cleaning service'],
      });
    }

    // ── 6. Conversational fallback via LLM ──────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemInstruction = `You are FixItNow's helpful service assistant. FixItNow connects homeowners with local verified professionals (Plumber, Electrician, AC Technician, Cleaner, Appliance Repair, Carpenter, Mechanic, Maintenance Worker).
Current Context: ${JSON.stringify(updatedContext)}. User logged in: ${Boolean(user)}.
Always respond warmly and concisely. Do NOT mention AI, APIs, or technical systems. Ask what home service they need if unclear.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: message || 'Hello',
          config: { systemInstruction },
        });

        return res.json({
          message: response.text || "Hello! I'm here to help you book home services. What do you need help with today?",
          context: updatedContext,
          quickReplies: ['Plumber', 'Electrician', 'AC Technician', 'Cleaner', 'Check Order Status'],
        });
      } catch (llmErr: any) {
        console.warn('[LLM] Fallback activated:', llmErr.message || llmErr);
      }
    }

    // Default greeting
    return res.json({
      message:
        "👋 Hello! Welcome to **FixItNow**.\n\nTell me what home service or repair you need, and I'll help you find a suitable professional nearby.",
      context: updatedContext,
      quickReplies: [
        '🔧 Faucet or pipe leaking',
        '⚡ Electrical switch sparking',
        '❄️ AC is not cooling',
        '🧹 Deep home cleaning',
        '📋 Check my order status',
      ],
    });
  } catch (err: any) {
    console.error('[assistantController] error:', err);
    return res.status(500).json({ error: err.message || 'Assistant error' });
  }
}
