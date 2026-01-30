#-------------------------------
# VIRTUAL NETWORK
#-------------------------------

# --- VNet with inline subnets and subnet delegation via azapi
// (must be done with azapi because I am forced to use inline subnet creation inside the vnet because of company policy)
// (and that does not support create delegation (for vnet integration). Only the specific resource azurerm_subnet can create integration directly.)
resource "azapi_resource" "vnet" {
  type     = "Microsoft.Network/virtualNetworks@2024-05-01"
  name     = lower("${var.project_initials}${var.random_suffix}-net-vNet")
  location = var.location
  parent_id = "/subscriptions/${var.client_config_subscription_id}/resourceGroups/${var.deploy_rg}"

  body = {
    properties = {
      addressSpace = {
        addressPrefixes = ["192.168.0.0/16"]
      }
      subnets = [
        {
          name       = "GwSubnet"
          properties = {
            addressPrefixes = ["192.168.1.0/24"]
            networkSecurityGroup = {
              id = azurerm_network_security_group.nsg_appgw.id
            }
          }
        },
        {
          name       = "ServicesSubnet"
          properties = {
            addressPrefixes = ["192.168.2.0/24"]
            networkSecurityGroup = {
              id = azurerm_network_security_group.nsg_serv.id
            }
          }
        },        
        {
          name       = "IntegrationSubnet"
          properties = {
            addressPrefixes = ["192.168.3.0/24"]
            networkSecurityGroup = {
              id = azurerm_network_security_group.nsg_serv.id
            }
            # add delegation for function vnet integration at creation time
            delegations = [
              {
                name       = "func-flex-delegation"
                properties = {
                  # Microsoft.App/environments (Container Apps / Functions Flex)
                  serviceName = "Microsoft.App/environments"                  
                }
              }
            ]
          }
        }
      ]
    }
    tags = var.shared_tags
  }

  # Make sure NSGs exist before the VNet PUT that includes them
  depends_on = [
    azurerm_network_security_group.nsg_appgw,
    azurerm_network_security_group.nsg_serv
  ]
}

#-------------------------------
# IMPORT CREATED SUBNETS
#-------------------------------

data "azapi_resource" "serv_subnet" {
  type        = "Microsoft.Network/virtualNetworks/subnets@2024-05-01"
  resource_id = "${azapi_resource.vnet.id}/subnets/ServicesSubnet"
}

data "azapi_resource" "integ_subnet" {
  type        = "Microsoft.Network/virtualNetworks/subnets@2024-05-01"
  resource_id = "${azapi_resource.vnet.id}/subnets/IntegrationSubnet"
}

data "azapi_resource" "gw_subnet" {
  type        = "Microsoft.Network/virtualNetworks/subnets@2024-05-01"
  resource_id = "${azapi_resource.vnet.id}/subnets/GwSubnet"
}

#-------------------------------
# NETWORK SECURITY GROUP 
#-------------------------------

resource "azurerm_network_security_group" "nsg_appgw" {
  name                = lower("${var.project_initials}${var.random_suffix}-net-nsg-AppGW")
  location            = var.location
  resource_group_name = var.deploy_rg
  tags = var.shared_tags
}

resource "azurerm_network_security_group" "nsg_serv" {
  name                = lower("${var.project_initials}${var.random_suffix}-net-nsg-Services")
  location            = var.location
  resource_group_name = var.deploy_rg
  tags = var.shared_tags
}

#-------------------------------
# NETWORK SECURITY GROUP RULES
#-------------------------------

# Allow frontend ports
resource "azurerm_network_security_rule" "appgw_http_https" {
  name                        = "Allow-HTTP-HTTPS"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_ranges     = ["80", "443"]
  source_address_prefix       = "Internet"
  destination_address_prefix  = "*"
  resource_group_name         = var.deploy_rg 
  network_security_group_name = azurerm_network_security_group.nsg_appgw.name
}

# Required for App Gateway v2
resource "azurerm_network_security_rule" "appgw_probe_ports" {
  name                        = "Allow-AppGW-Probes"
  priority                    = 200
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "65200-65535"
  source_address_prefix       = "GatewayManager"
  destination_address_prefix  = "*"
  resource_group_name         = var.deploy_rg
  network_security_group_name = azurerm_network_security_group.nsg_appgw.name
}

# Required for App Gateway v2
resource "azurerm_network_security_rule" "appgw_lb" {
  name                        = "Allow-AppGW-LB"
  priority                    = 300
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "*"
  source_port_range           = "*"
  destination_port_range      = "*"
  source_address_prefix       = "AzureLoadBalancer"
  destination_address_prefix  = "*"
  resource_group_name         = var.deploy_rg
  network_security_group_name = azurerm_network_security_group.nsg_appgw.name    
}

# Keep any broad deny AFTER these (higher number = lower priority)
resource "azurerm_network_security_rule" "deny_all_inbound" {
  name                        = "Deny-All-Inbound"
  priority                    = 500
  direction                   = "Inbound"
  access                      = "Deny"
  protocol                    = "*"
  source_port_range           = "*"
  destination_port_range      = "*"
  source_address_prefix       = "*"
  destination_address_prefix  = "*"
  resource_group_name         = var.deploy_rg 
  network_security_group_name = azurerm_network_security_group.nsg_appgw.name  
}