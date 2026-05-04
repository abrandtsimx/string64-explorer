import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor() { }

  decodeIfBase64(input: string): string {
    if (!input.includes(':') && !input.startsWith('{') && !input.startsWith('[') && /^[A-Za-z0-9+/=]{10,}$/.test(input)) {
      try {
        const decoded = atob(input);
        if (decoded.includes('"')) return decoded;
      } catch (e) {}
    }
    return input;
  }

  /**
   * Unity Easy Save serializes generic values as malformed JSON, e.g.
   * {"__type":"bool"false} (no comma between the type string and the literal).
   * Finds every "__type" entry (anywhere in an object), unwraps known JSON-shaped
   * payloads, and otherwise emits a readable surrogate:
   * {"__easySaveType":"…","__easySaveValue":"…"}.
   */
  normalizeEasySaveJson(text: string): string {
    let prev = '';
    let current = text;
    while (current !== prev) {
      prev = current;
      current = this.replaceEasySaveTypedWrappersOnce(current);
    }
    return current;
  }

  /**
   * When true, empties "Metadata" / "MetaData" arrays after Easy Save normalization
   * (legacy behavior for payloads that are still invalid).
   */
  prepareJsonForParse(text: string, clearMetadataArrays: boolean): string {
    let t = this.normalizeEasySaveJson(text);
    if (clearMetadataArrays) {
      t = t.replace(/"(Metadata|MetaData)"\s*:?\s*\[[^\]]*\]/g, '"$1": []');
    }
    return t;
  }

  /** @deprecated Use prepareJsonForParse; kept for any external callers expecting the name. */
  stripMetadata(text: string): string {
    return this.prepareJsonForParse(text, true);
  }

  private static readonly EASY_SAVE_TYPE_KEY = /"__type"\s*:\s*"/g;

  private replaceEasySaveTypedWrappersOnce(text: string): string {
    const parts: string[] = [];
    let i = 0;
    const re = DataService.EASY_SAVE_TYPE_KEY;
    while (i < text.length) {
      re.lastIndex = i;
      const km = re.exec(text);
      if (!km) {
        parts.push(text.slice(i));
        break;
      }
      const keyQuoteIdx = km.index;
      const objStart = this.findEnclosingObjectStart(text, keyQuoteIdx);
      if (objStart === -1) {
        parts.push(text.slice(i, keyQuoteIdx + 1));
        i = keyQuoteIdx + 1;
        continue;
      }

      parts.push(text.slice(i, objStart));

      const wrapperEnd = this.scanBalanced(text, objStart, '{', '}');
      if (wrapperEnd === -1) {
        parts.push(text.slice(objStart));
        break;
      }

      const afterPrefix = keyQuoteIdx + km[0].length;
      const typeEnd = text.indexOf('"', afterPrefix);
      if (typeEnd === -1 || typeEnd >= wrapperEnd) {
        parts.push(text.slice(objStart, wrapperEnd));
        i = wrapperEnd;
        continue;
      }

      const typeName = text.slice(afterPrefix, typeEnd);
      const valueStart = typeEnd + 1;
      const closingBraceIdx = wrapperEnd - 1;
      const parsed = this.parseJsonValueFragment(text, valueStart);
      let close = parsed ? parsed.end : -1;
      if (parsed) {
        while (close < text.length && /\s/.test(text[close])) close++;
      }

      const unwrapsWholeWrapper =
        !!parsed && close === closingBraceIdx && text[closingBraceIdx] === '}';

      if (unwrapsWholeWrapper) {
        parts.push(parsed!.raw);
      } else {
        const payloadRaw = text.slice(valueStart, closingBraceIdx).trim();
        parts.push(this.readableEasySaveReplacement(typeName, payloadRaw));
      }

      i = wrapperEnd;
    }
    return parts.join('');
  }

  /** Walk backward from the opening `"` of the `__type` key to the `{` that opens that object (skips strings). */
  private findEnclosingObjectStart(text: string, keyOpeningQuoteIdx: number): number {
    let i = keyOpeningQuoteIdx - 1;
    while (i >= 0 && /\s/.test(text[i])) i--;
    if (i >= 0 && text[i] === '{') return i;

    let depth = 0;
    while (i >= 0) {
      const c = text[i];
      if (c === '"') {
        i = this.skipPastStringBackward(text, i);
        continue;
      }
      if (c === '}') depth++;
      else if (c === '{') {
        if (depth === 0) return i;
        depth--;
      }
      i--;
    }
    return -1;
  }

  /** `closingQuoteIdx` is the index of the `"` that closes a JSON string; returns index before the opening `"`. */
  private skipPastStringBackward(text: string, closingQuoteIdx: number): number {
    let i = closingQuoteIdx - 1;
    let escaped = false;
    while (i >= 0) {
      const c = text[i];
      if (escaped) {
        escaped = false;
        i--;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        i--;
        continue;
      }
      if (c === '"') return i - 1;
      i--;
    }
    return -1;
  }

  /**
   * When the payload is not a single JSON value ending at the wrapper's `}`, try to
   * recursively normalize and parse; otherwise expose type + raw payload for the explorer.
   */
  private readableEasySaveReplacement(typeName: string, payloadRaw: string): string {
    if (!payloadRaw) {
      return JSON.stringify({ __easySaveType: typeName, __easySaveValue: null });
    }
    const nested = this.normalizeEasySaveJson(payloadRaw);
    try {
      JSON.parse(nested);
      return nested;
    } catch {
      const max = 500;
      const display = nested.length > max ? nested.slice(0, max) + '…' : nested;
      return JSON.stringify({ __easySaveType: typeName, __easySaveValue: display });
    }
  }

  /** Parse a single JSON value (scalar, string, object, array) starting at start; returns end index exclusive of the value. */
  private parseJsonValueFragment(text: string, start: number): { end: number; raw: string } | null {
    let pos = start;
    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (pos >= text.length) return null;

    if (text[pos] === '"') {
      let j = pos + 1;
      let escaped = false;
      while (j < text.length) {
        const ch = text[j];
        if (escaped) {
          escaped = false;
          j++;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          j++;
          continue;
        }
        if (ch === '"') {
          return { end: j + 1, raw: text.slice(pos, j + 1) };
        }
        j++;
      }
      return null;
    }

    if (text.startsWith('true', pos)) return { end: pos + 4, raw: 'true' };
    if (text.startsWith('false', pos)) return { end: pos + 5, raw: 'false' };
    if (text.startsWith('null', pos)) return { end: pos + 4, raw: 'null' };

    if (text[pos] === '-' || (text[pos] >= '0' && text[pos] <= '9')) {
      let j = pos + (text[pos] === '-' ? 1 : 0);
      if (j < text.length && text[j] === '0' && j + 1 < text.length && text[j + 1] >= '0' && text[j + 1] <= '9') {
        return null;
      }
      while (j < text.length && text[j] >= '0' && text[j] <= '9') j++;
      if (j < text.length && text[j] === '.') {
        j++;
        while (j < text.length && text[j] >= '0' && text[j] <= '9') j++;
      }
      if (j < text.length && (text[j] === 'e' || text[j] === 'E')) {
        j++;
        if (j < text.length && (text[j] === '+' || text[j] === '-')) j++;
        while (j < text.length && text[j] >= '0' && text[j] <= '9') j++;
      }
      return { end: j, raw: text.slice(pos, j) };
    }

    if (text[pos] === '{') {
      const end = this.scanBalanced(text, pos, '{', '}');
      if (end === -1) return null;
      return { end, raw: text.slice(pos, end) };
    }

    if (text[pos] === '[') {
      const end = this.scanBalanced(text, pos, '[', ']');
      if (end === -1) return null;
      return { end, raw: text.slice(pos, end) };
    }

    return null;
  }

  private scanBalanced(text: string, openIndex: number, openCh: string, closeCh: string): number {
    let depth = 0;
    let i = openIndex;
    let inStr = false;
    let escaped = false;
    while (i < text.length) {
      const ch = text[i];
      if (inStr) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === '"') {
          inStr = false;
        }
        i++;
        continue;
      }
      if (ch === '"') {
        inStr = true;
        i++;
        continue;
      }
      if (ch === openCh) depth++;
      if (ch === closeCh) {
        depth--;
        i++;
        if (depth === 0) return i;
        continue;
      }
      i++;
    }
    return -1;
  }

  recursivelyDecodeData(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(item => this.recursivelyDecodeData(item));

    const newObj: any = {};
    for (let key in obj) {
      let val = obj[key];
      if ((key === "RawData" || key === "MetaData") && typeof val === 'string' && val.length > 20) {
        try {
          const decoded = atob(val);
          if (decoded.includes('"')) {
            const parsed = JSON.parse(this.normalizeEasySaveJson(decoded));
            newObj[key] = this.recursivelyDecodeData(parsed);
            newObj[key].__wasBase64 = true;
            continue;
          }
        } catch (e) {}
      }
      newObj[key] = this.recursivelyDecodeData(val);
    }
    return newObj;
  }

  recursiveToolExtract(text: string): string[] {
    return this.recursiveElementExtract(text, "ToolAddress");
  }

  recursiveElementExtract(text: string, elementKey: string): string[] {
    let allElements = new Set<string>();
    let seenContent = new Set<string>();
    let queue = [text];

    const rawDataRegex = /"(?:RawData|MetaData)"\s*:\s*"([A-Za-z0-9+/=]{24,})"/g;
    const genericB64Regex = /"([A-Za-z0-9+/=]{40,})"/g;
    const escapedKey = elementKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dynamicRegex = new RegExp(`"${escapedKey}"\\s*:\\s*"([^":\\s][^"]*)"`, 'g');

    while (queue.length > 0) {
      let current = queue.shift();
      if (!current || seenContent.has(current)) continue;
      seenContent.add(current);
      
      const matches = [...current.matchAll(dynamicRegex)];
      for (const m of matches) {
        const value = m[1].trim();
        if (value && value !== ":" && value.length > 1) {
          allElements.add(value);
        }
      }

      const b64Targets = [...current.matchAll(rawDataRegex), ...current.matchAll(genericB64Regex)];
      for (const m of b64Targets) {
        try {
          const decoded = atob(m[1]);
          const cleaned = this.normalizeEasySaveJson(decoded);
          if (cleaned.includes('"')) queue.push(cleaned);
        } catch (e) {}
      }
    }

    return Array.from(allElements).sort();
}

  syntaxHighlight(json: string): string {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'token-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) cls = 'token-key';
        else cls = 'token-string';
      } else if (/true|false/.test(match)) cls = 'token-boolean';
      else if (/null/.test(match)) cls = 'token-null';
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  filterData(data: any, query: string): any {
    if (!query) return data;
    const lowerQuery = query.toLowerCase();

    if (typeof data !== 'object' || data === null) {
      // Check if value matches
      const valMatches = String(data).toLowerCase().includes(lowerQuery);
      return valMatches ? data : undefined;
    }

    if (Array.isArray(data)) {
      const filteredResult: any = {
        __wasArray: true,
        __originalLength: data.length,
        __autoExpand: true // Arrays with matches should always expand
      };
      let hasMatch = false;
      
      for (let i = 0; i < data.length; i++) {
        const filteredItem = this.filterData(data[i], query);
        if (filteredItem !== undefined) {
          filteredResult[i] = filteredItem;
          hasMatch = true;
        }
      }
      
      return hasMatch ? filteredResult : undefined;
    }

    // It's an object
    const filteredObj: any = {};
    let hasMatchingChild = false;

    // Preserve internal markers
    if (data.__wasBase64) filteredObj.__wasBase64 = true;

    for (const k in data) {
      if (k.startsWith('__')) continue;

      const filteredVal = this.filterData(data[k], query);
      if (filteredVal !== undefined) {
        filteredObj[k] = filteredVal;
        hasMatchingChild = true;
      }
    }

    // If object has matching children
    if (hasMatchingChild) {
      // Mark for auto-expansion
      filteredObj.__autoExpand = true;
      return filteredObj;
    }

    return undefined;
  }

  replaceAll(data: any, oldValue: any, newValue: any): any {
    if (data === oldValue) return newValue;
    
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.replaceAll(item, oldValue, newValue));
    }

    const newObj: any = {};
    for (const key in data) {
      newObj[key] = this.replaceAll(data[key], oldValue, newValue);
    }
    return newObj;
  }

  replaceAtPaths(data: any, paths: string[][], newValue: any, currentPath: string[] = []): any {
    const pathStr = JSON.stringify(currentPath);
    const shouldReplace = paths.some(p => JSON.stringify(p) === pathStr);

    if (shouldReplace) return newValue;

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item, i) => this.replaceAtPaths(item, paths, newValue, [...currentPath, String(i)]));
    }

    const newObj: any = {};
    for (const key in data) {
      if (key.startsWith('__')) {
        newObj[key] = data[key];
        continue;
      }
      newObj[key] = this.replaceAtPaths(data[key], paths, newValue, [...currentPath, key]);
    }
    return newObj;
  }

  countOccurrences(data: any, value: any): number {
    let count = 0;
    if (data === value) count++;
    
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        for (const item of data) {
          count += this.countOccurrences(item, value);
        }
      } else {
        for (const key in data) {
          // Skip internal markers
          if (key.startsWith('__')) continue;
          count += this.countOccurrences(data[key], value);
        }
      }
    }
    return count;
  }

  public getDisplayLabel(data: any, key: string, isParentArray: boolean): string {
    if (!isParentArray) return key;

    const isObject = typeof data === 'object' && data !== null;
    const isActuallyArray = Array.isArray(data) || (data && data.__wasArray);
    
    if (isObject && !isActuallyArray) {
      const descriptor = this.getDescriptor(data, null);
      return descriptor ? `[${key}] ${descriptor}` : `[${key}]`;
    }

    return `[${key}]`;
  }

  findAllInstances(data: any, value: any, path: string[] = ['Root'], displayPath: string[] = ['Root'], parent: any = null): any[] {
    let results: any[] = [];
    if (data === value) {
      results.push({
        path: [...path],
        displayPath: [...displayPath],
        context: this.getInstanceContext(parent, path, value)
      });
    }
    
    if (typeof data === 'object' && data !== null) {
      const isArr = Array.isArray(data) || data.__wasArray;
      const keys = Object.keys(data).filter(k => !k.startsWith('__'));

      for (const key of keys) {
        const childData = data[key];
        const label = this.getDisplayLabel(childData, key, isArr);

        results = results.concat(
          this.findAllInstances(childData, value, [...path, key], [...displayPath, label], data)
        );
      }
    }
    return results;
  }

  public getDescriptor(obj: any, fallback: string | null): string {
    if (!obj || typeof obj !== 'object') return fallback || '';

    const keys = Object.keys(obj);
    const idKey = keys.find(k => k.toLowerCase() === 'id' || k.toLowerCase().includes('id'));
    const nameKey = keys.find(k => k.toLowerCase() === 'name');
    const typeKey = keys.find(k => k.toLowerCase() === 'type');
    
    const idVal = idKey ? obj[idKey] : null;
    const nameVal = nameKey ? obj[nameKey] : null;
    const typeVal = typeKey ? obj[typeKey] : null;

    const isGuid = (val: any) => typeof val === 'string' && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const formatIdValue = (val: any) => {
      const s = String(val);
      if (isGuid(s)) return s.substring(0, 4) + '...';
      return s;
    };

    let idPart = '';
    let mainPart = '';

    if (idVal !== null && idVal !== undefined) {
      if (!isGuid(idVal)) {
        // Non-GUID ID: always include it
        idPart = String(idVal);
        mainPart = nameVal ? String(nameVal) : (typeVal ? String(typeVal) : '');
      } else {
        // GUID ID: only include if no name/type
        if (nameVal) {
          mainPart = String(nameVal);
        } else if (typeVal) {
          mainPart = String(typeVal);
        } else {
          idPart = formatIdValue(idVal);
        }
      }
    } else {
      mainPart = nameVal ? String(nameVal) : (typeVal ? String(typeVal) : '');
    }

    if (!mainPart && !idPart) mainPart = fallback || '';

    let result = (idPart && mainPart) ? `${idPart} | ${mainPart}` : (idPart || mainPart);

    // Cap and ellipsis at 40 characters
    if (result.length > 40) {
      result = result.substring(0, 40) + '...';
    }
    
    return result;
  }

  private getInstanceContext(parent: any, path: string[], value: any): string {
    const lastKey = path[path.length - 1];
    if (!parent) return lastKey;

    if (typeof parent === 'object' && !Array.isArray(parent)) {
      const descriptor = this.getDescriptor(parent, lastKey);
      if (descriptor !== lastKey && descriptor !== String(value)) {
         return `${lastKey} (in ${descriptor})`;
      }
    }
    
    return lastKey;
  }
}
