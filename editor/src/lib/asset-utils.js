import { supabase } from "./supabaseClient"; // Import the Supabase client

export const getAssets = async (parentId, listOnlyFolders, filterOut = []) => {
    let query = supabase.from("assets").select("*");

    if (parentId === null) {
        query = query.is("parentId", null);
    } else {
        query = query.eq("parentId", parentId);
    }

    const { data: assets, error } = await query;

    if (error) {
        console.error("Error fetching assets:", error);
        return [];
    }

    const filteredAssets = assets.filter((asset) => (!listOnlyFolders || asset.type === "folder") && !filterOut.includes(asset.id));

    // Sort the filtered assets alphabetically by name
    filteredAssets.sort((a, b) => a.name.localeCompare(b.name));

    return filteredAssets;
};

export const move = async (assetIds, destinationFolderId) => {
    console.log("moving assets", assetIds, destinationFolderId);
    const { data, error } = await supabase.from("assets").update({ parentId: destinationFolderId }).in("id", assetIds);

    if (error) {
        console.error("Error moving assets:", error);
    }

    return data;
};

export const deleteAssets = async (assetIds) => {
    const { data, error } = await supabase.from("assets").delete().in("id", assetIds);

    if (error) {
        console.error("Error deleting assets:", error);
    }

    return data;
};

export const copy = async (assetIds, destinationFolderId) => {
    console.log("copying assets", assetIds, destinationFolderId);
    const { data: originalAssets, error: fetchError } = await supabase.from("assets").select("*").in("id", assetIds);

    if (fetchError) {
        console.error("Error fetching assets for copy:", fetchError);
        return [];
    }

    // Exclude the 'id' field from the new assets
    const newAssets = originalAssets.map(({ id, ...asset }) => ({
        ...asset,
        parentId: destinationFolderId,
    }));

    console.log("newAssets", newAssets);

    const { data: copiedAssets, error: insertError } = await supabase.from("assets").insert(newAssets);

    if (insertError) {
        console.error("Error copying assets:", insertError);
    }

    return copiedAssets;
};

export const newFolder = async (name, destinationId) => {
    console.log("creating new folder", name, destinationId);
    const { data, error } = await supabase.from("assets").insert([{ name, type: "folder", parentId: destinationId }]);

    if (error) {
        console.error("Error creating new folder:", error);
    }

    return data;
};

export const rename = async (newName, assetId) => {
    const { data, error } = await supabase.from("assets").update({ name: newName }).eq("id", assetId);

    if (error) {
        console.error("Error renaming asset:", error);
    }
    console.log("Done renaming asset");
    return data;
};
