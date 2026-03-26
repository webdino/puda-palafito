import { getGoogleAuthToken } from "../auth/google";
import { getRotationConfig } from "../config";

/**
 * Google Drive API 連携ユーティリティ
 * https://developers.google.com/drive/api/reference/rest/v3
 */

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";

/**
 * 指定したファイル名でGoogle Drive上にJSONデータを保存（作成または上書き）します。
 * （スコープ：https://www.googleapis.com/auth/drive.file に依存）
 *
 * @param fileName 保存するファイル名 (例: 'puda_palafito_backup.json')
 * @param jsonData 保存するJSONデータオブジェクト
 * @returns 成功した場合はファイルのID、失敗した場合はnull
 */
export async function uploadJsonToDrive(
  fileName: string,
  jsonData: unknown,
  parentId: string | null = null,
  providedToken?: string,
): Promise<string | null> {
  const token = providedToken || await getGoogleAuthToken(false);
  if (!token) {
    console.error("No valid auth token to upload to Drive.");
    return null;
  }

  // 1. 同名のファイルが存在するかどうかを検索（今回アプリで作成したもののみ見つかる）
  const existingFileId = await findFileByName(fileName, token, parentId);

  const fileMetadata: Record<string, unknown> = {
    name: fileName,
    mimeType: "application/json",
  };
  if (parentId && !existingFileId) {
    fileMetadata.parents = [parentId];
  }

  const fileContent = JSON.stringify(jsonData);

  // 2. multipart/related リクエストボディの作成
  const boundary = `-------${crypto.randomUUID().replace(/-/g, "")}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(fileMetadata) +
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    fileContent +
    closeDelimiter;

  // 3. 上書き更新か、新規作成かでエンドポイントとメソッドを切り替え
  let fetchUrl = DRIVE_UPLOAD_URL;
  let method = "POST";

  if (existingFileId) {
    // 上書き（PATCH）
    fetchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
    method = "PATCH";
  }

  try {
    const response = await fetch(fetchUrl, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Drive API Upload error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("Exception during Drive API upload:", error);
    return null;
  }
}

/**
 * Drive APIの検索クエリ用に、文字列内のシングルクォート(')とバックスラッシュ(\)をエスケープします。
 */
function escapeDriveQueryString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Drive上から指定されたファイル名のファイルIDを検索します。
 */
async function findFileByName(
  fileName: string,
  token: string,
  parentId: string | null = null,
): Promise<string | null> {
  try {
    const escapedFileName = escapeDriveQueryString(fileName);
    let query = `name='${escapedFileName}' and trashed=false`;
    if (parentId) {
      const escapedParentId = escapeDriveQueryString(parentId);
      query += ` and '${escapedParentId}' in parents`;
    }
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`${DRIVE_API_URL}?q=${encodedQuery}&fields=files(id,name)`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Drive API Search error:", response.status);
      return null;
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error("Exception during Drive API search:", error);
    return null;
  }
}

/**
 * フォルダ名からGoogle Driveのフォルダを検索します。
 */
export async function findFolderByName(folderName: string, token: string): Promise<string | null> {
  try {
    const escapedFolderName = escapeDriveQueryString(folderName);
    const query = `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(`${DRIVE_API_URL}?q=${encodedQuery}&fields=files(id,name)`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Drive API Folder Search error:", response.status);
      return null;
    }

    const data = await response.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
    return null;
  } catch (error) {
    console.error("Exception during Drive API Folder search:", error);
    return null;
  }
}

/**
 * Google Driveに新しいフォルダを作成します。
 */
export async function createDriveFolder(folderName: string, token: string): Promise<string | null> {
  try {
    const metadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    const response = await fetch(DRIVE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Drive API Folder Create error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("Exception during Drive API Folder create:", error);
    return null;
  }
}

/**
 * 指定した名前のフォルダを検索し、なければ作成してそのIDを返します。
 */
export async function getOrCreateDriveFolder(
  folderName: string,
  token: string,
): Promise<string | null> {
  const existingId = await findFolderByName(folderName, token);
  if (existingId) {
    return existingId;
  }

  return await createDriveFolder(folderName, token);
}

/**
 * フォルダ内にローテーション管理用の全ファイルが揃っているか確認し、無ければ空で作成します。
 */
export async function ensureDriveRotationFiles(folderId: string): Promise<void> {
  const token = await getGoogleAuthToken(false);
  if (!token) return;

  const fileCount = getRotationConfig().maxFiles;

  const baseName = import.meta.env.WXT_EXPORT_FILE_NAME || "history.json";
  const baseFileName = baseName.replace(/\.json$/i, "");

  const tasks = Array.from({ length: fileCount }, (_, i) => {
    const fileName = `${baseFileName}_${i + 1}.json`;
    return async () => {
      const existingId = await findFileByName(fileName, token, folderId);
      if (!existingId) {
        await uploadJsonToDrive(fileName, [], folderId, token);
      }
    };
  });

  await Promise.all(tasks.map((task) => task()));
}
