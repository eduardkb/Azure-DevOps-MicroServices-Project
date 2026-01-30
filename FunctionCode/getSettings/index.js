export default async function (context, req) {
  const WEB_KEY = process.env.WEB_KEY

  const resQuery = req.query.key;
  if(!resQuery || resQuery != WEB_KEY){
    context.res = {
      status: 401,
      headers: { "Content-Type": "application/json" },
      body: {
        message: "Unauthorized"        
      }
    };
  }
  else{
    const appSettings = {
      TENANT_ID : process.env.AZURE_JWT_TENANT_ID ?? "N/A",
      EXPECTED_AUD : process.env.AZURE_JWT_EXPECTED_AUD ?? "N/A",
      WEB_CLIENTID : process.env.AZURE_JWT_WEB_CLIENTID ?? "N/A"      
    }
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: {
        message: "Settings retrieved.",
        settings: appSettings
      }
    };
  }
}
