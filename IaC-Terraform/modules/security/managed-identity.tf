resource "azurerm_user_assigned_identity" "managed-identity" {
  location            = var.location
  resource_group_name = var.deploy_rg
  name                = lower("${var.project_initials}${var.random_suffix}-sec-mi")  
  tags = var.shared_tags
}
