import SearchInput from '@/components/common/SearchInput';
import FilterChips from '@/components/common/filters/FilterChips';
import FilterMenu, { type FilterSection } from '@/components/common/filters/FilterMenu';

// The search and the filter above a team list, and the filters in force.
export default function TeamListToolbar({
  search,
  onSearchChange,
  placeholder,
  sections,
  onFilterChange,
}: {
  search: string;
  onSearchChange: (search: string) => void;
  placeholder: string;
  sections: FilterSection[];
  onFilterChange: (key: string, selected: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={placeholder}
          className="w-60"
        />
        <FilterMenu sections={sections} onChange={onFilterChange} />
      </div>
      <FilterChips sections={sections} onChange={onFilterChange} />
    </div>
  );
}
