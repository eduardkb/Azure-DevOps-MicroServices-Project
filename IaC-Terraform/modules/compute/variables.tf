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

# DATA SHARED VARIABLES
variable "storage_blob_endpoint" {
  type = string
}

variable "storage_access_key" {
  type = string
}

variable "storage_container_function" {
  type = string
}

variable "appinsights_conn_string" {
  type = string
}

variable "appinsights_instrument_key" {
  type = string
}

variable "storage_servicebus_conn_string" {
  type = string
}

# NETWORK SHARED VARIABLES
variable "network_integ_subnet_id" {
  type = string
}

# SECURITY SHARED VARIABLES
variable "security_keyvault_uri" {
  type = string
}

variable "security_keyvault_name" {
  type = string
}

variable "security_appconfig_endpoint" {
  type = string
}

variable "security_appconfig_name" {
  type = string
}

variable "security_keyvault_webkey_name" {
  type = string
}

variable "security_appconfig_tenantId_key" {
  type = string
}

variable "security_appconfig_apiClientId_key" {
  type = string
}

variable "security_appconfig_webClientId_key" {
  type = string
}

variable "security_appconfig_JwtClockSkew_key" {
  type = string
}

variable "security_appconfig_tenantId_label" {
  type = string
}

variable "security_appconfig_apiClientId_label" {
  type = string
}

variable "security_appconfig_webClientId_label" {
  type = string
}

variable "security_appconfig_JwtClockSkew_label" {
  type = string
}
