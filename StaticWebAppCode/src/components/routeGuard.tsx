import { useState, useEffect, useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { useLocation } from "react-router-dom";

export const RouteGuard = ({ ...props }) => {
  const location = useLocation();
  const { accounts } = useMsal();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
  const [permissionMsg, setPermissionMsg] = useState("");

  const onLoad = useCallback(() => {
    if (accounts[0]) {
      if (accounts[0].idTokenClaims!["roles"]) {
        const intersection = props.roles.filter((role: string) =>
          accounts[0].idTokenClaims!["roles"]!.includes(role)
        );
        if (intersection.length > 0) {
          setLoginMessage("");
          setPermissionMsg("");
          setIsAuthorized(true);
        } else {
          setLoginMessage("You don't have the correct permission.");
          if (location.pathname === "/info") {
            setPermissionMsg(
              "Only roles [{Read}, {Write}, {Admin}] are authorized to the 'Information' page.."
            );
          } else {
            if (location.pathname === "/user") {
              setPermissionMsg(
                "Only roles [{Write}, {Admin}] are authorized to view the 'User' page."
              );
            } else {
              if (location.pathname === "/admin") {
                setPermissionMsg(
                  "Only role [{Admin}] is authorized to view the 'Admin' page."
                );
              } else {
                setPermissionMsg(
                  "Only roles [{Read}, {Write}, {Admin}] are authorized to access this page."
                );
              }
            }
          }
          setIsAuthorized(false);
        }
      } else {
        setLoginMessage("You are logged in.");
        setPermissionMsg(
          "But you do not have sufficient permission to access this site."
        );
      }
    } else {
      setLoginMessage("You are not logged in.");
      setPermissionMsg("Please Login.");
      setIsAuthorized(false);
    }
  }, [accounts, props.roles, location.pathname]);

  useEffect(() => {    
    const run = async () => {
      await onLoad();
    };
    // Defer execution to avoid synchronous state updates
    setTimeout(run, 0);
  }, [onLoad]);

  return (
    <>
      {isAuthorized ? (
        <div className="pageContentSecondary">{props.children}</div>
      ) : (
        <div className="pageNotAuthorized">
          <h4>{loginMessage}</h4>
          <h5>{permissionMsg}</h5>
        </div>
      )}
    </>
  );
};

export default RouteGuard;
