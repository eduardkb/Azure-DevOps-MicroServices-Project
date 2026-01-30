import { ReactNode, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { MessageBox } from "../components/components";

interface layoutProps {
  children?: ReactNode;
}

const Layout: React.FC<layoutProps> = ({
  children
}) => {
  const [activeOp, setActiveOp] = useState("Home");

  const headerLinks = [
    { name: "Home", value: "/" },
    { name: "User Info", value: "/info" },
    { name: "Patient", value: "/patient" },
    { name: "Appointmnet", value: "/appointment" },
    { name: "Administration", value: "/admin" },
  ];
  return (    
    <>      
      <header className="header">
        {/* Big bar with background image */}
        <div className="header-main">
          {/* Transparent smaller bar for links */}
          <div className="header-links">
            <ul className="nav-list">
              {headerLinks.map((link) => (
                <li
                  key={link.value}
                  className={`nav-item ${activeOp === link.name ? "active" : ""}`}
                  onClick={() => setActiveOp(link.name)}
                >
                  <Link to={link.value}>{link.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Site title */}
          <div className="site-title">
            Az Project
          </div>
        </div>
        <MessageBox />
      </header>
      <main>
        <div className="main-content">{children}</div>
        <Outlet />
      </main>

      <footer className="footer">Developed By E.K.B.</footer>
    </>

  );
};

export default Layout;
