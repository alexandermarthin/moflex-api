import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EditorPage from "@/pages/EditorPage";
import RenderPage from "@/pages/RenderPage";
import "./App.css";

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/renderpage/:projectId" element={<RenderPage />} />

                <Route path="/editorpage/:projectId" element={<EditorPage />} />

                <Route path="/" element={<Navigate to="/editorpage/template1" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
