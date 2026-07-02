import fs from 'fs';
import path from 'path';

// 尋找最新的備份 JSON 檔案
function getLatestBackupFile() {
  const rootDir = process.cwd();
  const files = fs.readdirSync(rootDir);
  const backupFiles = files
    .filter(f => f.startsWith('Z-Money-FullBackup-') && f.endsWith('.json'))
    .map(f => {
      const match = f.match(/^Z-Money-FullBackup-(\d{4}-\d{2}-\d{2})(?:\((\d+)\))?\.json$/);
      if (match) {
        return {
          filename: f,
          date: match[1],
          version: match[2] ? parseInt(match[2], 10) : 0
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.version - a.version;
    });

  if (backupFiles.length > 0) {
    const latestFile = path.join(rootDir, backupFiles[0].filename);
    return latestFile;
  }
  return null;
}

function inject() {
  const latestBackupPath = getLatestBackupFile();
  if (!latestBackupPath) {
    console.error('未找到任何備份檔案');
    return;
  }
  console.log(`讀取最新備份檔案: ${latestBackupPath}`);
  
  const backupData = JSON.parse(fs.readFileSync(latestBackupPath, 'utf-8'));
  const qqqmWeekly = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scratch', 'qqqm_weekly.json'), 'utf-8'));
  
  if (!backupData.weeklyPrices) {
    backupData.weeklyPrices = [];
  }
  
  // 移除既有的 QQQM 歷史價格
  backupData.weeklyPrices = backupData.weeklyPrices.filter(wp => wp.ticker !== 'QQQM');
  
  // 合併並排序
  backupData.weeklyPrices = [...backupData.weeklyPrices, ...qqqmWeekly].sort((a, b) => {
    if (a.ticker !== b.ticker) return a.ticker.localeCompare(b.ticker);
    return a.date.localeCompare(b.date);
  });
  
  // 生成新的備份檔名 (今日日期 2026-07-02)
  const newBackupName = 'Z-Money-FullBackup-2026-07-02.json';
  const newBackupPath = path.join(process.cwd(), newBackupName);
  
  fs.writeFileSync(newBackupPath, JSON.stringify(backupData, null, 2));
  console.log(`成功將 QQQM 歷史價格注入並儲存為新備份檔案: ${newBackupPath}`);
}

inject();
