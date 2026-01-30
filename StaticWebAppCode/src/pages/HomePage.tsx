import { IPublicClientApplication } from "@azure/msal-browser";
import {
  useMsal,
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { Button } from "../components/components";

const SignInButton = () => {
  const signInClickHandler = (instance: IPublicClientApplication) => {
    instance.loginRedirect();
  };
  const { instance } = useMsal();
  return (
    <Button onClick={() => signInClickHandler(instance)}>
      <span>Sign in with SSO</span>
    </Button>
  );
};

const SignOutButton = () => {
  const signOutClickHandler = (instance: IPublicClientApplication) => {
    instance.logoutRedirect();
  };
  const { instance } = useMsal();
  return (
    
    <Button onClick={() => signOutClickHandler(instance)}>
      <span>Sign out</span>
    </Button>
  );
};

const HomePage = () => {
  return (
    <div className="page">
      <h2 className="page__title">Main Page</h2>
      <AuthenticatedTemplate>
        <p>
          You are <strong className="signedInText">signed in!</strong>
        </p>
        <SignOutButton />
      </AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <p>
          You have <strong className="notSignedInText">not logged in</strong>{" "}
          yet.{" "}
        </p>
        <SignInButton />
      </UnauthenticatedTemplate>
    </div>
  );
};

export default HomePage;
