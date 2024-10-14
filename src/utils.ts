import * as fs from 'fs';
import * as path from 'path';

/**
 * Checks if the node_modules directory exists in the given path.
 * @param dirPath - The path to check.
 * @returns A promise that resolves to true if node_modules exists, false otherwise.
 */
export const checkNodeModulesExist = async (dirPath: string): Promise<boolean> => {
  return new Promise((resolve) => {
    // Ensure the provided path is a directory
    fs.stat(dirPath, (err, stats) => {
      if (err || !stats.isDirectory()) {
        resolve(false);
        return;
      }

      // Check for the existence of the node_modules directory
      const nodeModulesPath = path.join(dirPath, 'node_modules');
      fs.access(nodeModulesPath, fs.constants.F_OK, (err) => {
        resolve(!err); // If no error, node_modules exists
      });
    });
  });
};

/**
 * 判断两个路径是否相同
 * @param path1 - 第一个路径
 * @param path2 - 第二个路径
 * @returns 是否相同
 */
export const arePathsEqual = (path1: string, path2: string): boolean => {
  // 规范化路径并替换分隔符
  const normalizedPath1 = path.normalize(path1.replace(/\\/g, '/').replace(/^[a-zA-Z]:\/|^\//, ''));
  const normalizedPath2 = path.normalize(path2.replace(/\\/g, '/').replace(/^[a-zA-Z]:\/|^\//, ''));

  // 比较规范化后的路径
  return normalizedPath1 === normalizedPath2; // 大小写敏感
};
