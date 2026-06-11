export type FieldSource = 'CORE' | 'DYNAMIC' | 'COMPUTED';

export type FieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'DATETIME'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'URL'
  | 'EMAIL'
  | 'PHONE'
  | 'MONEY'
  | 'PERCENT'
  | 'FILE'
  | 'IMAGE'
  | 'JSON';

export interface ProductFieldDefinition {
  id: number;
  key: string;
  label: string;
  field_type: FieldType;
  description?: string;
  placeholder?: string;
  help_text?: string;
  default_value?: unknown;
  is_required: boolean;
  options?: { value: string; label: string }[] | string[];
  unit?: string;
  show_in_form: boolean;
  show_in_list: boolean;
  is_active?: boolean;
  validation_rules?: Record<string, unknown>;
}

export interface ListColumnConfig {
  id?: number;
  field_key: string;
  field_source: FieldSource;
  label: string;
  is_visible: boolean;
  is_sortable: boolean;
  is_filterable: boolean;
  width?: string;
  order: number;
}

export interface FormFieldConfig {
  id?: number;
  field_key: string;
  field_source: FieldSource;
  label: string;
  is_visible: boolean;
  is_required: boolean;
  is_readonly: boolean;
  placeholder?: string;
  help_text?: string;
  section: string;
  order: number;
}

export interface DetailFieldConfig {
  id?: number;
  field_key: string;
  field_source: FieldSource;
  label: string;
  section: string;
  is_visible: boolean;
  order: number;
}

export interface ProductRow {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  category: number;
  category_name?: string;
  unit_price: string;
  cost_price?: string | null;
  is_active: boolean;
  dynamic_fields?: Record<string, unknown>;
  total_stock?: number;
  available_stock?: number;
  [key: string]: unknown;
}
