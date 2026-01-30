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
