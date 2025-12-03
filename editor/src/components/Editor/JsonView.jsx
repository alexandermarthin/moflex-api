import ReactJson from "@microlink/react-json-view";

export default function JsonView({ jsonState }) {
    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-auto">
                <ReactJson
                    src={jsonState}
                    theme="rjv-default"
                    style={{ backgroundColor: "transparent" }}
                    enableClipboard={true}
                    displayDataTypes={false}
                    displayObjectSize={true}
                    name={null}
                    collapsed={1}
                    collapseStringsAfterLength={50}
                />
            </div>
        </div>
    );
}
