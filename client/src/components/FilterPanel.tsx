import type { ServiceCategory } from '../types';

interface FilterPanelProps {
  categories: ServiceCategory[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  minRating: number;
  onSelectMinRating: (rating: number) => void;
  maxPrice: number;
  onSelectMaxPrice: (price: number) => void;
  sortBy: string;
  onSelectSortBy: (sort: string) => void;
  onlyOnline: boolean;
  onToggleOnlyOnline: (online: boolean) => void;
  onReset: () => void;
}

export default function FilterPanel({
  categories,
  selectedCategory,
  onSelectCategory,
  minRating,
  onSelectMinRating,
  maxPrice,
  onSelectMaxPrice,
  sortBy,
  onSelectSortBy,
  onlyOnline,
  onToggleOnlyOnline,
  onReset,
}: FilterPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Filter & Sort</h3>
        <button
          onClick={onReset}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Reset All
        </button>
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Category</label>
        <select
          value={selectedCategory}
          onChange={(e) => onSelectCategory(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sort By */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Sort By</label>
        <select
          value={sortBy}
          onChange={(e) => onSelectSortBy(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-200"
        >
          <option value="distance">Nearest Distance</option>
          <option value="rating">Highest Rated</option>
          <option value="price_low">Price: Low to High</option>
          <option value="price_high">Price: High to Low</option>
        </select>
      </div>

      {/* Minimum Rating */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
          Min Rating: {minRating > 0 ? `${minRating}+ Stars` : 'Any'}
        </label>
        <div className="flex gap-2">
          {[0, 4, 4.5, 4.8].map((stars) => (
            <button
              key={stars}
              type="button"
              onClick={() => onSelectMinRating(stars)}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition ${
                minRating === stars
                  ? 'border-primary bg-teal-50 text-primary'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {stars === 0 ? 'All' : `${stars}★`}
            </button>
          ))}
        </div>
      </div>

      {/* Max Price Range */}
      <div>
        <div className="flex justify-between text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
          <span>Max Hourly Rate</span>
          <span className="text-primary font-bold">₹{maxPrice}</span>
        </div>
        <input
          type="range"
          min="200"
          max="2000"
          step="50"
          value={maxPrice}
          onChange={(e) => onSelectMaxPrice(Number(e.target.value))}
          className="w-full accent-primary cursor-pointer"
        />
      </div>

      {/* Online Only Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Available Pros Only</span>
        <input
          type="checkbox"
          checked={onlyOnline}
          onChange={(e) => onToggleOnlyOnline(e.target.checked)}
          className="h-4 w-4 accent-primary rounded cursor-pointer"
        />
      </div>
    </div>
  );
}
