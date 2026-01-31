output "compute_function_id" {
  value       = azurerm_function_app_flex_consumption.function.id
}

output "compute_static-wa_id" {
  value       = azurerm_static_web_app.static-wa.id
}

output "compute_static-wa_host-name" {
  value       = azurerm_static_web_app.static-wa.default_host_name
}

output "compute_static-fa_host-name" {
  value       = azurerm_function_app_flex_consumption.function.default_hostname
}

#output "compute_function_identity" {
#  value       = azurerm_function_app_flex_consumption.function.identity[0].principal_id
#}

output "compute_static-wa_name" {
  value       = azurerm_static_web_app.static-wa.name 
}

output "compute_function_name" {
  value       = azurerm_function_app_flex_consumption.function.name 
}