output "appinsights_conn_string" {
  value = azurerm_application_insights.app-insights.connection_string
  sensitive = true
}

output "appinsights_instrument_key" {
  value = azurerm_application_insights.app-insights.instrumentation_key
  sensitive = true
}