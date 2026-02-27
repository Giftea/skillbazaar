interface Props {
  data: unknown;
}

function tokenize(json: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b)|\bnull\b|([{}\[\],])/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(json)) !== null) {
    if (match.index > last) {
      tokens.push(json.slice(last, match.index));
    }
    const [full, strPart, colon, num, bool] = match;

    if (strPart !== undefined) {
      const cls = colon ? 'json-key' : 'json-string';
      tokens.push(<span key={match.index} className={cls}>{full}</span>);
    } else if (num !== undefined) {
      tokens.push(<span key={match.index} className="json-number">{full}</span>);
    } else if (bool !== undefined) {
      tokens.push(<span key={match.index} className="json-bool">{full}</span>);
    } else if (full === 'null') {
      tokens.push(<span key={match.index} className="json-null">{full}</span>);
    } else {
      tokens.push(full);
    }
    last = match.index + full.length;
  }
  if (last < json.length) tokens.push(json.slice(last));
  return tokens;
}

export default function JsonViewer({ data }: Props) {
  const json = JSON.stringify(data, null, 2);
  return <div className="json-viewer">{tokenize(json)}</div>;
}
