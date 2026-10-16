import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { HomePage } from "./components/HomePage";
import { InvitationComposer } from "./components/InvitationComposer";
import { InvitationLandingPage } from "./components/InvitationLandingPage";
import { InvitationManagement } from "./components/InvitationManagement";
import { InvitationShare } from "./components/InvitationShare";
import { AppShell } from "./components/SiteChrome";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<InvitationComposer />} />
        <Route path="/i/:publicId" element={<InvitationLandingPage />} />
        <Route path="/sent/:publicId" element={<InvitationShare />} />
        <Route path="/manage" element={<InvitationManagement />} />
        <Route path="/manage/:publicId" element={<InvitationManagement />} />
        <Route
          path="*"
          element={
            <AppShell width="narrow">
              <h1 className="font-serif text-5xl">This page isn’t on the ticket.</h1>
              <Link to="/create" className="btn btn-primary mt-6">
                Create your ticket
              </Link>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
