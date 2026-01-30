resource "azurerm_servicebus_namespace" "servicebus" {
  name                = lower("${var.project_initials}${var.random_suffix}-appbe-servicebus")
  location            = var.location
  resource_group_name = var.deploy_rg
  sku                 = "Basic"

  tags = var.shared_tags
}

resource "azurerm_servicebus_queue" "billing-queue" {
  name         = "uploaddoc"
  namespace_id = azurerm_servicebus_namespace.servicebus.id
}