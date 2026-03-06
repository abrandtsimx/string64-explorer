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
}
