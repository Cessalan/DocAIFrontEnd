import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";

export const loadFilesForChat = async (chatId) => {

  //console.log("ATTEMPTING to fetch all files for CHAT: "+ chatId);
  const storage = getStorage();
  const uploadsPath = `chats/${chatId}/uploads`;
  const folderRef = ref(storage, uploadsPath);

  try {
    const result = await listAll(folderRef);

    const fileInfos = await Promise.all(
      result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);
        return {
          name: itemRef.name,
          path: itemRef.fullPath,
          downloadURL: url
        };
      })
    );

    return fileInfos;

  } catch (error) {
    console.error("Failed to list files:", error);
    return [];
  }
};

