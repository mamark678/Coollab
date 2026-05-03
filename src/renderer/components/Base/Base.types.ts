export type BaseViewType = 'table' | 'board' | 'gallery' | 'list';

export interface BaseView {
  id: string;
  name: string;
  type: BaseViewType;
  config: {
    visibleColumns?: string[];
    sortColumn?: string;
    sortDirection?: 'asc' | 'desc';
    filterProperty?: string;
    filterValue?: string;
    groupByProperty?: string; // for board view
  };
}

export interface BaseData {
  scopedFolderId?: string | null;
  views: BaseView[];
  activeViewId: string;
}
