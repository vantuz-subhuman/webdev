function val(el, v) {
    return v ? el.val(v) : el.val();
}

function text(el, v) {
    return v ? el.text(v) : el.text();
}

const VIEW = {
    init: function() {
        this.AccSelector.el_selector = $('#account-selector');
        this.AccSelector.el_balance = $('#balance');
        this.AccSelector.el_reload_btn = $('#balance-reload');
        this.AddAccountModal.el_modal = $('#account-add-modal');
        this.AddAccountModal.el_pk_input = $('#account-add-pk');
        this.AddAccountModal.el_pk_input_err = $('#account-add-pk-err');
        this.AddAccountModal.el_submit_btn = $('#account-add-btn');
        this.RemoveAccountModal.el_modal = $('#account-remove-modal');
        this.RemoveAccountModal.el_address_input = $('#account-remove-address');
        this.RemoveAccountModal.el_init_btn = $('#account-remove-init-btn');
        this.RemoveAccountModal.el_submit_btn = $('#account-remove-btn');
        this.GetCoinsModal.el_modal = $('#account-coins-modal');
        this.GetCoinsModal.el_address_input = $('#account-coins-address');
        this.GetCoinsModal.el_submit_btn = $('#account-coins-btn');
        this.GetCoinsModal.el_queue_list = $('#account-coins-queue-list');

        this.DeployContractModal.init();
        this.Editor.init();

        $(window).resize(function () {
            let h = $('#navbar').height();
            $('body').css('padding-top', `${h+30}px`);
        });
    },
    Editor: {
        ace: null,
        el_editor_row: null,
        el_editor_overlay: null,
        el_compile_btn: null,
        el_autocompile_check: null,
        el_compile_spinner: null,
        el_solc_selector: null,
        el_structure: null,
        el_structure_autoexpand: null,
        init: function() {
            this.ace = ace.edit('editor');
            this.ace.session.setMode("ace/mode/solidity");
            this.el_editor_row = $('#editor-row');
            this.el_editor_overlay = $('#editor-row-overlay');
            this.el_compile_btn = $('#compile-btn');
            this.el_autocompile_check = $('#editor-autocompile');
            this.el_compile_spinner = $('#compile-spinner');
            this.el_solc_selector = $('#solc-selector');
            this.el_structure = $('#compiled-structure');
            this.el_structure_autoexpand = $('#compiled-structure-autoexpand');
        },
        setEditorEnabled(v) {
            if (v) {
                this.el_editor_row.removeClass('disabled-area');
            } else {
                this.el_editor_row.addClass('disabled-area');
            }
            this.el_editor_overlay.attr('hidden', v);
        },
        setCompileButtonAvailable(v) {
            this.el_compile_btn.attr('hidden', !v);
        },
        setSolcVersions(versions) {
            this.el_solc_selector.html('');
            if (!versions) { return; }
            let self = this;
            Util.arrayIfNot(versions).forEach((v, idx) => {
                self.el_solc_selector.append(
                    `<option idx="${idx}">${v}</option>`)
            });
        },
        selectedSolcVersion(v) {
            return val(this.el_solc_selector, v);
        },
        setStructureCards(structure) {
            let el = this.el_structure;
            el.html('');
            el.append(`<div class="card">
                        <div class="card-header d-flex justify-content-between" id="structureCardHeadingMain">
                            <div class="d-inline">
                                <div class="modal-comment" style="padding: 0; margin: 0;">
                                    <b>Time:</b> ${structure.compiledAt}
                                </div>
                                <div class="modal-comment" style="padding: 0; margin: 0;">
                                    <b>Compiler:</b> ${structure.compiler}
                                </div>
                                <div class="modal-comment" style="padding: 0; margin: 0;">
                                    <b>Struct:</b> ${structure.hash}
                                </div>
                            </div>
                        </div>
                    </div>`);
            let collapsible = structure.contracts.length > 1;
            let expanded = !collapsible || this.el_structure_autoexpand.is(':checked');
            structure.contracts.forEach(function (contract, i) {
                let headingId = 'structureCardHeading' + i;
                let collapseId = 'structureCardCollapse' + i;
                let el_card_body = $(
                    `<div id="${collapseId}" class="collapse ${expanded ? 'show' : ''} list-group" aria-labelledby="${headingId}" data-parent="#accordion">
                    </div>`);
                contract.methods.forEach(function (method) {
                    el_card_body.append(`<span class="list-group-item structure-item">${method.name} (GAS: ${method.gas})</span>`);
                });
                let el_card = $(
                    `<div class="card">
                        <div class="card-header d-flex justify-content-between" id="${headingId}">
                            <div class="d-inline">
                                <div>
                                    <button class="btn btn-link structure-header" data-toggle="collapse" ${collapsible ? `data-target="#${collapseId}"` : ''} aria-expanded="true" aria-controls="${collapseId}">
                                        ${contract.name}
                                    </button>
                                    <span class="structure-header">(GAS: ${contract.gas})</span>
                                </div>
                                <div class="modal-comment" style="padding: 0; margin: 0;">
                                    <b>Struct:</b> ${contract.hash}
                                </div>
                            </div>
                            <button class="btn-sm btn-info" onclick="deployContract('${contract.name}')">
                                Deploy
                            </button>
                        </div>
                    </div>`)
                    .append(el_card_body);
                el.append(el_card);
            });
        }
    },
    AccSelector: {
        el_selector: null,
        el_balance: null,
        el_reload_btn: null,
        selectedAddress: function (a) {
            return val(this.el_selector, a);
        },
        addAddress: function (address) {
            this.el_selector.append(
                $('<option></option>')
                    .attr('key', address)
                    .text(address));
        },
        addAndSelectAddress: function (address) {
            this.addAddress(address);
            this.selectedAddress(address);
        },
        balance: function (b) {
            return text(this.el_balance, b ? b + ' ETH' : undefined);
        }
    },
    AddAccountModal: {
        el_modal: null,
        el_pk_input: null,
        el_pk_input_err: null,
        el_submit_btn: null,
        privateKey: function (pk) {
            return val(this.el_pk_input, pk);
        },
        markInputError: function(error) {
            if (error) {
                this.el_pk_input_err.text('This account is already added');
                this.el_pk_input.addClass('is-invalid');
                this.submitEnabled(false);
            } else {
                this.el_pk_input.removeClass('is-invalid');
                this.submitEnabled(true);
            }
        },
        hasInputError: function() {
            return this.el_pk_input.hasClass('is-invalid');
        },
        submitEnabled: function (v) {
            this.el_submit_btn.attr('disabled', !v);
        },
        closeModal: function() {
            this.el_modal.modal('toggle');
        }
    },
    RemoveAccountModal: {
        el_init_btn: null,
        el_modal: null,
        el_address_input: null,
        el_submit_btn: null,
        address: function (a) {
            return val(this.el_address_input, a);
        },
        closeModal: function() {
            this.el_modal.modal('toggle');
        },
        initEnabled: function (v) {
            this.el_init_btn.attr('disabled', !v);
        },
    },
    GetCoinsModal: {
        el_modal: null,
        el_address_input: null,
        el_submit_btn: null,
        el_queue_list: null,
        address: function (a) {
            return val(this.el_address_input, a);
        },
        closeModal: function() {
            this.el_modal.modal('toggle');
        },
        addQueueRequest: function (req) {
            if (!req) {return;}
            this.el_queue_list.append(
                $(`<li class="account-coins-queue-list-item list-group-item" req="${req.id}">
                        <div class="d-flex justify-content-between align-items-center">
                            <span>${req.address}</span>
                            <span class="badge badge-info badge-pill account-coins-queue-list-item-time">${new Date(req.expectedRequestMillis).toLocaleTimeString()}</span>
                        </div>
                        <div class="modal-comment account-coins-queue-list-item-tx-div" hidden="hidden">
                            <span><b>Tx:</b> <span class="account-coins-queue-list-item-tx"></span></span>
                        </div>
                   </li>`));
        },
        findRequestItem: function(req) {
            return this.el_queue_list.find(`li[req="${req.id}"]`);
        },
        markRequestBeginning: function(req) {
            if (!req) {return;}
            let item = this.findRequestItem(req);
            item.addClass('active');
            $('<img src="assets/Dual_Ring-3s-64px.gif" width="24px"/>')
                .insertBefore(item.find('.account-coins-queue-list-item-time'));
        },
        markRequestTxCreated: function(req, tx) {
            if (!req) {return;}
            let item = this.findRequestItem(req);
            item.find('.account-coins-queue-list-item-tx').text(tx);
            item.find('.account-coins-queue-list-item-tx-div').attr('hidden', false);
        },
        removeQueueRequest: function(req) {
            if (!req) {return;}
            this.findRequestItem(req).remove();
        },
        submitEnabled: function (v) {
            this.el_submit_btn.attr('disabled', !v);
        },
    },
    DeployContractModal: {
        el_modal: null,
        el_address_from: null,
        el_submit_btn: null,
        init: function () {
            this.el_modal = $('#deploy-contract-modal');
            this.el_address_from = $('#contract-deploy-from');
            this.el_contract_name = $('#contract-deploy-name');
            this.el_gas_cost = $('#contract-deploy-gas-estimate');
            this.el_gas_limit = $('#contract-deploy-gas-limit');
            this.el_gas_price = $('#contract-deploy-gas-price');
            this.el_submit_btn = $('#deploy-contract-btn');
        },
        showModal: function(fromAddress, name, gas, cb) {
            this.el_address_from.text(fromAddress);
            this.el_contract_name.text(name);
            this.el_gas_cost.text(gas + ' WEI');
            this.el_gas_limit.val(gas * 2);
            this.el_gas_price.val(5000000000);
            let self = this;
            this.el_submit_btn.click(function () {
                self.el_modal.modal('toggle');
                cb({gasLimit: self.el_gas_limit.val(), gasPrice: self.el_gas_price.val()});
            });
            this.el_modal.modal('toggle');
        }
    }
};