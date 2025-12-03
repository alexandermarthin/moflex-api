import { useState, useEffect } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { DndContext, useSensor, useSensors, PointerSensor, MouseSensor, TouchSensor, KeyboardSensor, useDroppable, useDraggable } from "@dnd-kit/core";

const Draggable = (props) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: props.item.id,
        data: props.item,
    });

    const combinedTransform = props.transformGroup && props.isSelected ? { x: props.transformGroup.x, y: props.transformGroup.y } : transform;
    const style = {
        transform: combinedTransform ? `translate3d(${combinedTransform.x}px, ${combinedTransform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.5 : 1,
        userSelect: "none",
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            {props.children}
        </div>
    );
};

const Droppable = (props) => {
    const { isOver, setNodeRef } = useDroppable({
        id: props.item.id,
        data: props.item,
    });

    return (
        <div ref={setNodeRef} className={`${isOver ? "bg-blue-100" : ""}`}>
            {props.children}
        </div>
    );
};

export default function AssetList() {
    const [expandedFolders, setExpandedFolders] = useState([]);
    const { assets, setAssets } = useProjectStore();
    const { activeCompId, setActiveCompId } = useEditorStore();

    useEffect(() => {
        const assetValues = Object.values(assets);
        if (assetValues.length > 0) {
            console.log(assetValues[0].name);
        }
    }, []);

    const [selectedItems, setSelectedItems] = useState([]);
    const [lastSelected, setLastSelected] = useState();
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const toggleFolder = (e, id) => {
        e.stopPropagation();
        setExpandedFolders((prev) => (prev.includes(id) ? prev.filter((folderId) => folderId !== id) : [...prev, id]));
    };

    const toggleSelect = (e, id) => {
        e.stopPropagation();
        if (e.metaKey) {
            setSelectedItems((prevSelected) => (prevSelected.includes(id) ? prevSelected.filter((item) => item !== id) : [...prevSelected, id]));
            setLastSelected(id);
            return;
        }
        if (e.shiftKey) {
            let a = id;
            let b = lastSelected;
            let numbers = [];

            if (a <= b) {
                for (let i = a; i <= b; i++) {
                    numbers.push(i);
                }
            } else {
                for (let i = a; i >= b; i--) {
                    numbers.push(i);
                }
            }
            setSelectedItems(numbers);
            return;
        }
        if (selectedItems.length === 1 && selectedItems[0] === id) {
            setSelectedItems([]);
            setLastSelected(null);
        } else {
            setSelectedItems([id]);
            setLastSelected(id);
        }
    };

    const handleDragStart = (event) => {
        setIsDragging(true);
        const { active } = event;
        if (!selectedItems.includes(active.id)) {
            setSelectedItems([active.id]);
            setLastSelected(active.id);
        }
        setDragOffset({ x: 0, y: 0 });
    };

    const handleDragMove = (event) => {
        const { delta } = event;
        setDragOffset({ x: delta.x, y: delta.y });
    };

    const handleDragEnd = (event) => {
        setIsDragging(false);
        const { active, over } = event;
        setDragOffset({ x: 0, y: 0 });

        if (over && over.id !== active.id) {
            if (selectedItems.includes(over.id)) {
                console.log("Cannot move files - target is one of the selected items");
                return;
            }
            console.log(`Dropped ${active.id} into ${over.id}`);
            const updatedAssets = { ...assets };
            selectedItems.forEach((itemId) => {
                if (updatedAssets[itemId]) {
                    updatedAssets[itemId] = { ...updatedAssets[itemId], parentId: over.id };
                }
            });
            console.log("Updated assets:", updatedAssets);
            setAssets(updatedAssets);
            setSelectedItems([]);
        }
    };

    const pointerSensor = useSensor(PointerSensor, {
        activationConstraint: {
            distance: 0.01,
        },
    });
    const mouseSensor = useSensor(MouseSensor);
    const touchSensor = useSensor(TouchSensor);
    const keyboardSensor = useSensor(KeyboardSensor);

    const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor, pointerSensor);

    const getChildrenOfParent = (parentId) => {
        return Object.values(assets)
            .filter((item) => item.parentId === parentId)
            .sort((a, b) => a.name.localeCompare(b.name));
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div
                    className="lg:col-span-8"
                    onClick={(e) => {
                        setSelectedItems([]);
                    }}
                >
                    <Droppable item={{ id: 0, type: "root" }}>
                        <div className="min-h-screen">
                            {getChildrenOfParent(0).map((item) => {
                                if (item.type === "folder") {
                                    const isExpanded = expandedFolders.includes(item.id);
                                    const children = getChildrenOfParent(item.id);

                                    return (
                                        <div key={item.id}>
                                            <Droppable item={item}>
                                                <Draggable item={item} selectedItems={selectedItems}>
                                                    <div
                                                        onClick={(e) => toggleSelect(e, item.id)}
                                                        className={`cursor-pointer p-2 select-none rounded flex items-center ${selectedItems.includes(item.id) ? "bg-gray-200" : "hover:bg-gray-100"}`}
                                                    >
                                                        <div className={`mr-2 transition-transform ${isExpanded ? "rotate-90" : ""}`} onClick={(e) => toggleFolder(e, item.id)}>
                                                            ▶
                                                        </div>
                                                        {item.name} ({item.type})
                                                    </div>
                                                </Draggable>
                                                {isExpanded && (
                                                    <div className="ml-4">
                                                        {children.map((child) => {
                                                            if (child.type === "folder") {
                                                                const isChildExpanded = expandedFolders.includes(child.id);
                                                                const grandChildren = getChildrenOfParent(child.id);

                                                                return (
                                                                    <div key={child.id}>
                                                                        <Droppable item={child}>
                                                                            <Draggable item={child} selectedItems={selectedItems}>
                                                                                <div
                                                                                    onClick={(e) => {
                                                                                        toggleSelect(e, child.id);
                                                                                    }}
                                                                                    className={`cursor-pointer p-2 select-none rounded flex items-center ${selectedItems.includes(child.id) ? "bg-gray-200" : "hover:bg-gray-100"
                                                                                        }`}
                                                                                >
                                                                                    <div
                                                                                        className={`mr-2 transition-transform ${isChildExpanded ? "rotate-90" : ""}`}
                                                                                        onClick={(e) => toggleFolder(e, child.id)}
                                                                                    >
                                                                                        ▶
                                                                                    </div>
                                                                                    {child.name} ({child.type})
                                                                                </div>
                                                                            </Draggable>
                                                                            {isChildExpanded && (
                                                                                <div className="ml-4">
                                                                                    {grandChildren.map((grandChild) => (
                                                                                        <Draggable
                                                                                            key={grandChild.id}
                                                                                            item={grandChild}
                                                                                            transformGroup={dragOffset}
                                                                                            isSelected={selectedItems.includes(grandChild.id)}
                                                                                            selectedItems={selectedItems}
                                                                                        >
                                                                                            <div
                                                                                                onClick={(e) => {
                                                                                                    toggleSelect(e, grandChild.id);
                                                                                                }}
                                                                                                className={`cursor-pointer p-2 select-none rounded flex items-center ${selectedItems.includes(grandChild.id) ? "bg-gray-200" : "hover:bg-gray-100"
                                                                                                    }`}
                                                                                            >
                                                                                                {grandChild.type === "folder" && (
                                                                                                    <div
                                                                                                        className={`mr-2 transition-transform ${expandedFolders.includes(grandChild.id) ? "rotate-90" : ""
                                                                                                            }`}
                                                                                                        onClick={(e) => toggleFolder(e, grandChild.id)}
                                                                                                    >
                                                                                                        ▶
                                                                                                    </div>
                                                                                                )}
                                                                                                {grandChild.name} ({grandChild.type})
                                                                                            </div>
                                                                                        </Draggable>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </Droppable>
                                                                    </div>
                                                                );
                                                            } else {
                                                                return (
                                                                    <Draggable
                                                                        key={child.id}
                                                                        item={child}
                                                                        transformGroup={dragOffset}
                                                                        isSelected={selectedItems.includes(child.id)}
                                                                        selectedItems={selectedItems}
                                                                    >
                                                                        <div
                                                                            onClick={(e) => {
                                                                                toggleSelect(e, child.id);
                                                                            }}
                                                                            className={`cursor-pointer p-2 select-none rounded ${selectedItems.includes(child.id) ? "bg-gray-200" : "hover:bg-gray-100"
                                                                                } ${activeCompId === child.id ? "border-2 border-blue-500" : ""}`}
                                                                            onDoubleClick={() => {
                                                                                if (child.type === "composition") {
                                                                                    setActiveCompId(child.id);
                                                                                    console.log("Active composition:", child);
                                                                                }
                                                                            }}
                                                                        >
                                                                            {child.name} ({child.type})
                                                                        </div>
                                                                    </Draggable>
                                                                );
                                                            }
                                                        })}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <Draggable key={item.id} item={item} transformGroup={dragOffset} isSelected={selectedItems.includes(item.id)} selectedItems={selectedItems}>
                                            <div
                                                onClick={(e) => {
                                                    toggleSelect(e, item.id);
                                                }}
                                                className={`cursor-pointer p-2 select-none rounded ${selectedItems.includes(item.id) ? "bg-gray-200" : "hover:bg-gray-100"} ${activeCompId === item.id ? "border-2 border-blue-500" : ""
                                                    }`}
                                                onDoubleClick={() => {
                                                    if (item.type === "composition") {
                                                        setActiveCompId(item.id);
                                                        console.log("Active composition:", item);
                                                    }
                                                }}
                                            >
                                                {item.name} ({item.type})
                                            </div>
                                        </Draggable>
                                    );
                                }
                            })}
                        </div>
                    </Droppable>
                </div>
            </div>
        </DndContext>
    );
}
