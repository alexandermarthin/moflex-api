// import { supabase } from "./supabaseClient";

export const createAssets = (items, parentId = 0) => {
    const assets = {};
    items.forEach((item) => {
        const asset = {
            id: item.id,
            name: item.name,
            type: item.type,
            parentId,
        };

        if (item.type === "composition") {
            asset.width = item.width;
            asset.height = item.height;
            asset.duration = item.duration;
            asset.frameRate = item.frameRate;
            asset.backgroundColor = item.backgroundColor;
            asset.clipIds = item.layers ? item.layers.map((_, index) => `${item.id}_${index}`) : [];
        } else if (item.type === "footage") {
            asset.file = item.file;
            asset.width = item.width;
            asset.height = item.height;
            asset.duration = item.duration;
            asset.frameRate = item.frameRate;
            asset.isStill = item.isStill;
            asset.isSolid = item.isSolid;
            asset.solidColor = item.solidColor;

            if (item.isStill && !item.isSolid) {
                asset.type = "image";
            } else if (item.isSolid) {
                asset.type = "solid";
            } else if (!item.isStill && item.frameRate === 0) {
                asset.type = "audio";
            } else if (!item.isStill && item.frameRate > 0) {
                asset.type = "video";
            }
        }

        assets[item.id] = asset;

        if (item.items) {
            const childAssets = createAssets(item.items, item.id);
            Object.assign(assets, childAssets);
        }
    });
    return assets;
};



export const getSignedUrl = async (filePath) => {
    // const { data, error } = await supabase.storage.from(import.meta.env.VITE_BUCKETNAME).createSignedUrl(filePath, 3600);

    // if (error) {
    //     console.error("Error getting signed URL:", error);
    //     return null;
    // }

    // return data?.signedUrl;
    return null;
};
