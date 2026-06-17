/**
 * Schema-related TypeScript interfaces.
 *
 * Types for Column, Table, Schema, and the API response shapes
 * from GET /schema endpoints.
 */

export interface ColumnInfo {
  name: string;
  data_type: string;
  nullable: boolean;
  primary_key: boolean;
  foreign_key: string | null;
  description: string | null;
}

export interface TableInfo {
  name: string;
  schema_name: string;
  columns: ColumnInfo[];
  description: string | null;
}

export interface SchemaMetadata {
  database_name: string;
  dialect: string;
  tables: TableInfo[];
}

export interface IngestResponse {
  message: string;
  chunks_ingested: number;
}

export interface SchemaStatusResponse {
  chunks_stored: number;
  vector_store_ready: boolean;
}

/**
 * Config types for LLM provider management.
 */
export interface LLMConfig {
  provider: string;
  model: string;
  available_providers: string[];
}

export interface ModelsMap {
  [provider: string]: string[];
}

export interface UpdateLLMRequest {
  provider: string;
  model: string;
}

export interface UpdateLLMResponse {
  provider: string;
  model: string;
  message: string;
}
