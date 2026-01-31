variable "project_initials" {
  description = "Initials for this project"
  type        = string
  default     = "ekb"
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "centralus"
}

variable "deploy_rg" {
  description = "Resource group to deploy resources into"
  type        = string
  default     = "microProject"
}

variable "shared_tags" {
  description = "Shared tags for all resources"
  type = map(string)
  default = {
    "owner" = "Eduard Keller Buhali",
    "reason" = "Study - Full Microservices Project"
  }
}
