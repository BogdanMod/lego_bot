import { useEffect } from 'react';
import { init } from '@twa-dev/sdk';

function App() {
  useEffect(() => {
    init();
  }, []);

  return (
    <div className="app">
      <h1>Dialogue Constructor</h1>
      <p>Mini App для создания диалогов</p>
    </div>
  );
}

export default App;

