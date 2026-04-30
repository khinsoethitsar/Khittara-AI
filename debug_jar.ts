
import fs from 'fs';
const stats = fs.statSync('android/gradle/wrapper/gradle-wrapper.jar');
console.log('Size:', stats.size);
const buffer = fs.readFileSync('android/gradle/wrapper/gradle-wrapper.jar');
console.log('Buffer length:', buffer.length);
console.log('Base64 start:', buffer.toString('base64').substring(0, 50));
