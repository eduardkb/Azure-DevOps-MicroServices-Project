resource "azurerm_static_web_app" "static-wa" {
  name                = lower("${var.project_initials}${var.random_suffix}-appfe-staticWebApp")
  resource_group_name = var.deploy_rg
  location            = var.location
  sku_tier            = "Standard"
  sku_size            = "Standard"
  public_network_access_enabled = false
  lifecycle {
    prevent_destroy = false
  }
  app_settings = {
    VITE_BACKEND_API_URL="https://www.edukb.site"
  }
  tags = var.shared_tags
}

