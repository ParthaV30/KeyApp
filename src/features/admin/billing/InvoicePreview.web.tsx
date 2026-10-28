import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { A } from '@/features/admin/ui';

// Web preview: the bill HTML in a sandboxed iframe, sized to its content so the page scrolls naturally.
export function InvoicePreview({ html }: { html: string }) {
  const [height, setHeight] = useState(640);
  return (
    <View style={st.frame}>
      <iframe
        title="Invoice preview"
        srcDoc={html}
        sandbox="allow-same-origin"
        style={{ width: '100%', height, border: 0, display: 'block', background: '#FFFFFF' }}
        onLoad={event => {
          const doc = event.currentTarget.contentDocument;
          // body height is the bill itself; documentElement never reports less than the frame's own height.
          if (doc?.body) setHeight(doc.body.scrollHeight + 2);
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  frame: { width: '100%', backgroundColor: A.panel, borderWidth: 1, borderColor: A.line, borderRadius: 12, overflow: 'hidden' },
});
