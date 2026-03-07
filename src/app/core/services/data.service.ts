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

  stripMetadata(text: string): string {
    return text.replace(/"Metadata"\s*:?\s*\[[^\]]*\]/g, '"Metadata": []');
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
            const parsed = JSON.parse(this.stripMetadata(decoded));
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
          const cleaned = this.stripMetadata(decoded);
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
        let label = key;

        // If we're inside an array, try to get a better label for the object items
        if (isArr && typeof childData === 'object' && childData !== null) {
          label = this.getDescriptor(childData, key);
        }

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
