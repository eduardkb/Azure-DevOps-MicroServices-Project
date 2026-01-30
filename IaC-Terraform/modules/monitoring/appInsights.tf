resource "azurerm_application_insights" "app-insights" {
  name                = lower("${var.project_initials}${var.random_suffix}-monitor-ai")
  location            = var.location
  resource_group_name = var.deploy_rg
  application_type    = "web"
}