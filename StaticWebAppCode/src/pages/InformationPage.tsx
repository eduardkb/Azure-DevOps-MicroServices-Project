import { useMsal } from "@azure/msal-react";
import { getLoginRequest } from "../authConfig";
import { useEffect, useState } from "react";

const InformationPage: React.FC = () => {
  const { accounts, instance } = useMsal();
  const [accessToken, setAccessToken] = useState("");
  const [idToken, setIDToken] = useState("");

  

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        if (!accounts[0] || !accounts[0].idToken || accounts[0].idToken === "") {
          setIDToken("ID Token not available yet.");
          setAccessToken("Access Token not available yet.");
        } else {
          setIDToken(accounts[0].idToken);
          instance.setActiveAccount(accounts[0]);
          const res = await instance.acquireTokenSilent(getLoginRequest());
          setAccessToken(res.accessToken);
        }
      } catch {
        setAccessToken("Access Token not available yet.");
      }
    };
  
    fetchTokens();
  }, [accounts, instance]);
  

  return (
    <div className="page">
      <h2 className="page__title">Display User Information:</h2>
      
      <form className="info-form">
        <div className="form-group">
          <label htmlFor="name">Full Name:</label>
          <input type="text" id="name" value={accounts[0].name} readOnly />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input type="text" id="email" value={accounts[0].username} readOnly />
        </div>

        <div className="form-group">
          <label htmlFor="tenantID">Tenant ID:</label>
          <input type="text" id="tenantID" value={accounts[0].tenantId} readOnly />
        </div>

        <div className="form-group">
          <label htmlFor="roles">Roles:</label>
          <input type="text" id="roles" value={accounts[0].idTokenClaims!.roles} readOnly />
        </div>

        <div className="form-group textarea-group">
          <label htmlFor="idToken">ID Token:</label>
          <textarea id="idToken" value={idToken} rows={5} readOnly></textarea>
        </div>

        <div className="form-group textarea-group">
          <label htmlFor="accessToken">Access Token:</label>
          <textarea id="accessToken" value={accessToken} rows={5} readOnly></textarea>
        </div>
      </form>
    </div>
  );
};

export default InformationPage;
