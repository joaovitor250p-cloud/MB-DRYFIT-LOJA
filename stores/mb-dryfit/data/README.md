# Nex inventory transfer

The owner authorized importing the attached `Exportar.xls` and its matching product photos from `meucomercio.com.br/mbdryfit`.

`nex-import.json` is the reviewed, server-only import manifest prepared by `scripts/prepare-nex-import.py`. It preserves the spreadsheet's physical quantity, reservations, exact codes (including leading zeros), GTIN aliases, lateral reference, original names and categories. One deterministic model is shared by its color/size variants. Photos are selected per model/color, reused by every size, and copied to R2 before product insertion. An unknown color never receives another color's photo. Products start internal, consistent with the owner's established publication workflow. Existing products are not overwritten.

The import data is separate from schema migrations. The transfer endpoint accepts only actions over this fixed manifest and requires a temporary `NEX_IMPORT_KEY` runtime secret. It accepts no uploaded rows or arbitrary URLs. The bounded batches are transactional and resumable; replay never resets sold stock. Remove the temporary runtime key after transfer and redeploy to disable execution. Only the owner can read the import report and explicitly publish ready variations.

Source snapshot: 1,297 distinct source codes; 225 models; 551 color groups; 486 selected images for 1,181 variations; 116 variations without a matching color image. The spreadsheet's 30 negative physical balances and all legacy reserved quantities are kept and flagged for review. Original Nex code and GTIN resolve to the same variation where they differ.

The Nex source supplies color images rather than a separate model cover. Imported `main_photo` stays null and the interface uses the selected color photo as its cover, so changing only size cannot switch the displayed color. The owner can choose a separate main photo later.

The complete follow-up review found 17 model names split across old Nex category names (including blank and incorrect categories). `nex-regroup.json` contains the fixed reviewed correction: 148 member variations, 18 model-ID changes and 6 color-photo changes. All five pairs of differing photo files were visually checked and depict the same garment/color. No color-size tuple overlaps in the merged groups. Similar names with different fabric, symbol or cut qualifiers remain separate; reused photos/references alone never establish identity.

The corrected catalog has 208 imported models and 535 model/color groups; 1,182 variations have their own color image and 115 still lack one. There are 481 selected image files; the 486 originally stored image assets remain available. `nex-model-identities.json` preserves the selected existing model IDs when regenerating the import. Source Nex categories remain audit metadata and no longer determine model identity.

`/api/nex-model-regroup` accepts only `status` and `regroup` over its server-only manifest with the same temporary transfer secret. Each group has a transactional audit and completion marker; preconditions abort on owner edits. It updates only `model_id` and the reviewed same-color `photo`. No products are deleted and no code, reference, stock, reservation, price or publication field is changed. The schema-only audit migration contains no inventory data. Remove the runtime secret and redeploy after execution.
