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

# LOCAL VARIABLES
variable "imported_resource_group" {
  description = "RG to import resources"
  type        = string
  default     = "rg-Eduard"
}

variable "imported_dns_zone_name" {
  description = "Imported dns zone to configure A Record pointing to App Gateway"
  type        = string
  default     = "edukb.site"
}

variable "dns_zone_prefix" {
  description = "Dns zone prefix to be used (ex: www or app). If APEX, put '@'"
  type        = string
  default     = "www"
}

# SECURITY VARIABLES
variable "security_mi_id" {
  type        = string
}

variable "security_appGwCert_id" {
  type        = string
}

# NETWORK VARIABLES
variable "network_gw_subnet_id" {
  type        = string
}

# COMPUTE VARIABLES
variable "compute_static-wa_host-name" {
  type        = string
}

variable "compute_static-fa_host-name" {
  type        = string
}
