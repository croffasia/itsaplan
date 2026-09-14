import { Search } from 'lucide-react';
import type { LeadCampaign } from '@/lib/api';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ApprovalLeadFilters } from '../../services/leads.service';

export default function LeadsApprovalFilters({
  campaigns,
  filters,
  search,
  onFiltersChange,
  onSearchChange,
}: {
  campaigns: LeadCampaign[];
  filters: ApprovalLeadFilters;
  search: string;
  onFiltersChange: (filters: ApprovalLeadFilters) => void;
  onSearchChange: (search: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row">
      <div className="relative min-w-0 flex-1 lg:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          placeholder="Search leads…"
          className="pl-9"
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <Select
        value={filters.campaignId ?? 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, campaignId: value === 'all' ? undefined : value })
        }
      >
        <SelectTrigger className="w-full lg:w-56">
          <SelectValue placeholder="All campaigns" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All campaigns</SelectItem>
          {campaigns.map((campaign) => (
            <SelectItem key={campaign.id} value={campaign.id}>
              {campaign.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.reviewStatus ?? 'all'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, reviewStatus: value === 'all' ? undefined : value })
        }
      >
        <SelectTrigger className="w-full lg:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All review states</SelectItem>
          <SelectItem value="ready_for_review">Ready for review</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="possible_duplicate">Possible duplicate</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.sort ?? 'qualification_desc'}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, sort: value as ApprovalLeadFilters['sort'] })
        }
      >
        <SelectTrigger className="w-full lg:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="qualification_desc">Highest score</SelectItem>
          <SelectItem value="newest">Newest analysis</SelectItem>
          <SelectItem value="oldest">Oldest analysis</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
