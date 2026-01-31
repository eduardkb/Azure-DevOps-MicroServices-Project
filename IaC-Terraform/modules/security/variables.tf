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
  default     = "ekb-SharedKeyVault"
}

variable "imported_resource_group" {
  description = "Existing RG to import resources"
  type        = string
  default     = "SharedResources"
}

variable "AppReg_ApiClientID" {
  description = "Audience to be used while verifying authentication token on API"
  type = string
  default = "989ce838-38af-4bf6-8cef-762ae61ef95a"
}

variable "AppReg_WebClientID" {
  description = "Audience to be used while verifying authentication token on API"
  type = string
  default = "4f4234aa-6410-4251-9786-0d2fea0d2f3d"
}

# COMPUTE VARIABLES
#variable "compute_function_identity" {
#  type        = string
#}

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