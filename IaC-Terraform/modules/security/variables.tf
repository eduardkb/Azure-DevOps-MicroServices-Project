# GLOBAL VARIABLES
variable "project_initials" {
  description = "Initials for this project"
  type        = string
}

variable "random_suffix" {
  description = "Three-letter random suffix"
  type        = string
}

variable "deploy_rg" {
  description = "Resource group to deploy resources into"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "shared_tags" {
  description = "Shared tags for all resources"
  type        = map(string)
}

variable "client_config_tenant_id" {
  type        = string
}

variable "client_config_object_id" {
  type        = string
}

variable "random_web_key" {
  type        = string
}

# LOCAL VARIABLES
variable "imported_keyvault" {
  description = "Existing Keyvault to import secrets"
  type        = string
  default     = "kv-eduard-ussc"
}

variable "imported_resource_group" {
  description = "Existing RG to import resources"
  type        = string
  default     = "rg-Eduard"
}

variable "AppReg_ApiClientID" {
  description = "Audience to be used while verifying authentication token on API"
  type = string
  default = "378c023f-5e3e-405b-84af-89b7334ebcde"
}

variable "AppReg_WebClientID" {
  description = "Audience to be used while verifying authentication token on API"
  type = string
  default = "ae470f08-1305-4ea7-be0e-727c2ac062b0"
}

# COMPUTE VARIABLES
variable "compute_function_identity" {
  type        = string
}

# DATA VARIABLES
variable "storage_id" {
  type        = string
}

variable "storage_servicebus_id" {
  type        = string
}

variable "storage_access_key" {
  type        = string
}

variable "db_cosmosdb_conn_string" {
  type        = string
}