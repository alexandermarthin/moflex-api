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

                <Route path="/" element={<Navigate to="/editorpage/632ab2e9-70fb-429e-a682-a3542fcc9cd8" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
