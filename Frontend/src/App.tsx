import { Routes, Route } from "react-router-dom";
import SignupPage from "./pages/signup/SignupPage";
import LoginPage from "./pages/login/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardPage";

function App() {
  return <>
  <Routes>
    <Route path="/signup" element={<SignupPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/home" element={<DashboardPage/>}/>
  </Routes>
  </>;
}

export default App;