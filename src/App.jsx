import { Routes, Route } from "react-router-dom";
import Form from "./components/Form/Form";
import ThankYou from "./components/ThankYou/ThankYou";

export default function App() {

  return (
    <Routes>
      <Route
        path="/"
        element={<Form />}
      />

      <Route
        path="/thank-you"
        element={<ThankYou />}
      />
    </Routes>
  );
}
