export const CRUD_DIALOG_STYLES = `
  table.bms-table th, table.bms-table td { padding: 10px 12px; }
  table.bms-table thead { background: rgba(0,0,0,.04); }
  .overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:10; }
  .dialog {
    position:fixed; z-index:11; top:50%; left:50%;
    transform:translate(-50%,-50%); background:white;
    padding:24px; min-width:480px; max-width:min(560px, 96vw); border-radius:8px;
    max-height:90vh; overflow-y:auto;
  }
`;
