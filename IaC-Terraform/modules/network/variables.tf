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

variable "client_config_subscription_id" {
  description = "Subscription ID"
  type        = string
}

# COMPUTE VARIABLES
variable "compute_function_id" {
  type        = string
}

variable "compute_static-wa_id" {
  type        = string
}

variable "compute_static-wa_host-name" {
  type        = string
}

# DATA VARIABLES
variable "db_cosmosdb_id" {
  type        = string
}

# SECURITY VARIABLES
variable "security_appconfig_id" {
  type        = string  
}

variable "security_keyvault_id" {
  type        = string  
}