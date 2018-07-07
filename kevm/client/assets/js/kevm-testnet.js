// const Network = Object.freeze(new Web3NetworkConstructor('https://kevm-testnet.iohkdev.io:8546', 'Cardano Test-Net'));
const Network = Object.freeze(new MockNetworkConstructor());

const FAUCET_INTERVAL_MILLIS = 30000;
const FAUCET_MAX_PENDING_REQUESTS = 10;
const CACHED_SOLC_VERSIONS = new Set(['soljson-v0.4.24+commit.e67f0147.js']);

const STATE = {
    init: function() {
        if (!this.accounts) {
            this.accounts.push({pk: '0x' + Util.newRandomPrivateKey()});
        }
        $.each(this.accounts, (i, account) => {
            if (!account.pk) {
                console.error('Invalid account object with no PK found - ignoring.', account);
                return;
            }
            account.acc = Network.recoverAcc(account.pk);
        });
    },
    accounts: [{
        pk: '0xf4946488e7be562f9140ef497acf806860ab66458f41933e554ec7fc08f5dff8',
        acc: null
    }, {
        pk: '0xfccf05690b35be1dcff1c64e901667f99d1c904d7579faa97764c3e69cdb856b',
        acc: null
    }],
    selectedAccount: '0xC97bd1B1cfCC80F0BFEb451e3be964Bdde0B1508',
    faucet: {
        lastRequestMillis: 0,
        queue: [],
        pushRequest: function(address) {
            let request = {
                id: Util.newRandomHex(16),
                address: address
            };
            let queue = this.queue;
            if (queue.length > 0) {
                let last = queue[queue.length - 1];
                request.expectedRequestMillis = last.expectedRequestMillis + FAUCET_INTERVAL_MILLIS;
            } else {
                let currentMillis = new Date().getTime();
                request.expectedRequestMillis = Math.max(this.lastRequestMillis + FAUCET_INTERVAL_MILLIS, currentMillis);
            }
            queue.push(request);
            return request;
        }
    },
    editor: {
        autoCompile: false
    }
};

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
};

const COMPILER = {
    latestResult: null,
    currentVersion: 0,
    compiler: null,
    versions: [],
    init: function(cb) {
        let self = this;
        BrowserSolc.getVersions((a,b) => {
            self.versions = Object.freeze(Object.entries(b));
            this.setSelectedVersion(0, cb);
        });
    },
    setSelectedVersion: function(idx, cb) {
        let version = this.versions[idx];
        if (!version) {
            throw "no solc version found with idx: " + idx;
        }
        console.log('Switchin current solc version to: ' + version + ' (idx ' + idx + ')');
        let self = this;
        BrowserSolc.loadVersion(version[1], c => {
            self.compiler = c;
            this.currentVersion = idx;
            if (cb) { cb(version); }
        }, CACHED_SOLC_VERSIONS.has(version[1]) ? `assets/js/solc-bin/${version[1]}` : undefined);
    },
    getSelectedVersion: function() {
        if (!this.versions) {
            throw "no solc versions available yet!";
        }
        if (this.currentVersion < 0) {
            throw "no solc version is selected!"
        }
        if (this.currentVersion > this.versions.length) {
            throw "illegal solc version is selected: " + this.currentVersion;
        }
        return this.versions[this.currentVersion];
    },
    compile: function(source, optimise=1) {
        let compiler = this.compiler;
        if (!compiler) {
            throw "solc compiler not found for version: " + version;
        }
        return compiler.compile(source, optimise);
    }
};

function appendAccountToWorkspace(acc) {
    STATE.accounts.push({
        pk: acc.privateKey,
        acc: acc
    });
    STATE.selectedAccount = acc.address;
    VIEW.AccSelector.addAndSelectAddress(acc.address);
    updateBalance();
}

function addAccountRandomizeKey() {
    VIEW.AddAccountModal.privateKey(Util.newRandomPrivateKey());
}

function accountRemoveSetAddress(address = STATE.selectedAccount) {
    VIEW.RemoveAccountModal.address(address);
}

function accountCoinsSetAddress(address = STATE.selectedAccount) {
    VIEW.GetCoinsModal.address(address);
}

function updateBalance(address = STATE.selectedAccount) {
    if (VIEW.AccSelector.selectedAddress() === address) {
        VIEW.AccSelector.balance('...');
    }
    Network.getBalance(address, r => {
        console.log('Received balance: ' + r);
        if (VIEW.AccSelector.selectedAddress() === address) {
            VIEW.AccSelector.balance(r);
        }
    });
}

function updateAccountRemoveButtonAvailability() {
    let selectedAccountRequests = STATE.faucet.queue.find((r) => r.address === STATE.selectedAccount);
    VIEW.RemoveAccountModal.initEnabled(!selectedAccountRequests);
}

function updateFaucetButtonAvailability() {
    VIEW.GetCoinsModal.submitEnabled(
        STATE.faucet.queue.length < FAUCET_MAX_PENDING_REQUESTS);
}

function queueFaucetRequest(address) {
    let request = STATE.faucet.pushRequest(address);
    updateFaucetButtonAvailability();
    updateAccountRemoveButtonAvailability();
    if (STATE.faucet.queue.length === 1) {
        function requestWorker(req) {
            let timeout = req.expectedRequestMillis - new Date().getTime();
            setTimeout(function () {
                let currentMillis = new Date().getTime();
                if (STATE.faucet.queue.length === 0 || STATE.faucet.queue[0].id !== req.id) {
                    return;
                }
                console.log('Requesting faucet for: ', req);
                STATE.faucet.lastRequestMillis = req.requestMillis = currentMillis;
                VIEW.GetCoinsModal.markRequestBeginning(req);
                // mock request
                Network.faucetRequest(req.address, function (tx) {
                    console.log('Received faucet tx id: ' + tx);
                    VIEW.GetCoinsModal.markRequestTxCreated(req, tx);
                    Network.getTransactionReceiptMined(tx).then(function (tx) {
                        console.log('Received faucet tx: ', tx);
                        if (VIEW.AccSelector.selectedAddress() === req.address) {
                            updateBalance(req.address);
                        }
                        if (STATE.faucet.queue.length === 0 || STATE.faucet.queue[0].id !== req.id) {
                            return;
                        }
                        STATE.faucet.queue.splice(0,1);
                        VIEW.GetCoinsModal.removeQueueRequest(req);
                        updateFaucetButtonAvailability();
                        updateAccountRemoveButtonAvailability();
                        if (STATE.faucet.queue.length > 0) {
                            requestWorker(STATE.faucet.queue[0]);
                        }
                    });
                });
            }, timeout);
        }
        requestWorker(request);
    }
    VIEW.GetCoinsModal.addQueueRequest(request);
}

function deployContract(name) {
    if (!COMPILER.latestResult) {
        console.log('No latest compilation result is available!')
        return;
    }
    let contractResult = COMPILER.latestResult.contracts[name];
    if (!contractResult) {
        console.log('No contract found with the name: ' + name, COMPILER.latestResult);
        return;
    }
    let contract = new Network.web3.eth.Contract(JSON.parse(contractResult.interface));
    console.log('Contract >', contract);
    let deploy = contract.deploy({data: '0x' + contractResult.bytecode});
    console.log('Deploy >', deploy, deploy.estimateGas());
    // try {
    //     deploy.send({from: STATE.selectedAccount, gas: 5000000, gasPrice: 5000000000}, function (error, txHash) {
    //         if (error) {
    //             console.log('error > ', error);
    //         } else {
    //             console.log('tx > ', txHash);
    //             Network.getTransactionReceiptMined(txHash)
    //                 .then(function (tx) {
    //                     console.log('Contract tx > ', tx)
    //                 }, function (err) {
    //                     console.log('Failed to wait for contract tx!', err)
    //                 });
    //         }
    //     }).then(function (res) {
    //         console.log('1 > ', res);
    //     }, function (err) {
    //         console.log('2 > ', err);
    //     });
    // } catch (e) {
    //     console.warn('Failed to send contract!', e);
    // }
}

function compileCurrentCode() {
    VIEW.Editor.setEditorEnabled(false);
    setTimeout(() => {
        let code = VIEW.Editor.ace.getValue();
        let ver = COMPILER.getSelectedVersion()[1];
        let res = COMPILER.compile(code);
        console.log('Compiled result: ', res);
        let annotations = [];
        if (res.errors) {
            annotations = res.errors.map((s) => {
                let pref = s.split(' ', 1)[0];
                let coords = pref.split(':');
                if (coords[0] || coords[3]) {
                    console.warn('COORDINATES! ' + s);
                }
                let message = s.substr(pref.length+1).replace(new RegExp('↵', 'g'),'\n').trim();
                return {row: parseInt(coords[1])-1, column: parseInt(coords[2])-1, text: message, type: 'error'};
            });
        } else {
            COMPILER.latestResult = res;
            let contracts = Object.entries(res.contracts).map(function (e) {
                let estimates = e[1].gasEstimates;
                let hash = Util.sha1(e[1].bytecode.dropTail(68)).substr(-16);
                let methods = Object.entries(estimates.external).map(function (e) {
                    return {name: e[0], gas: e[1]}
                });
                return {name: e[0], gas: estimates.creation, hash: hash, methods: methods};
            });
            let totalHash = Util.sha1('' + contracts.map(c => c.hash)).substr(-32);
            VIEW.Editor.setStructureCards({
                compiledAt: new Date().toISOString(),
                compiler: ver,
                hash: totalHash,
                contracts: contracts
            });
        }
        VIEW.Editor.ace.session.setAnnotations(annotations);
        VIEW.Editor.setEditorEnabled(true);
    }, 100);
}

$(function() {

    STATE.init();
    VIEW.init();

    COMPILER.init(function (version) {
        VIEW.Editor.setSolcVersions(COMPILER.versions.map(v => v[0]));
        VIEW.Editor.selectedSolcVersion(version[0]);
        compileCurrentCode();
    });

    $.each(STATE.accounts, (i, account) => {
        VIEW.AccSelector.addAddress(account.acc.address)
    });

    if (STATE.selectedAccount) {
        VIEW.AccSelector.selectedAddress(STATE.selectedAccount);
    } else {
        STATE.selectedAccount = VIEW.AccSelector.selectedAddress();
        console.log('Init selected account: ', STATE.selectedAccount);
    }

    function onAccountSelectorChange() {
        let addr = VIEW.AccSelector.selectedAddress();
        STATE.selectedAccount = addr;
        updateAccountRemoveButtonAvailability();
        updateBalance(addr);
    }

    updateBalance();
    VIEW.AccSelector.el_selector.change(onAccountSelectorChange);
    VIEW.AccSelector.el_reload_btn.click(() => updateBalance());

    VIEW.AddAccountModal.el_pk_input.on('change paste keyup', function (e) {
        let val = VIEW.AddAccountModal.privateKey();
        if (val.length === 64 && Network.web3.utils.isHex(val)) {
            VIEW.AddAccountModal.markInputError();
        } else {
            VIEW.AddAccountModal.markInputError('Invalid Ethereum private key');
            return;
        }
        if (STATE.accounts.find(a => a.acc.privateKey.endsWith(val))) {
            VIEW.AddAccountModal.markInputError('This account is already added');
        }
    });

    function updateRemoveAccountAvailability() {
        VIEW.RemoveAccountModal.el_init_btn.attr('disabled', STATE.accounts.length < 2);
    }

    VIEW.AddAccountModal.el_submit_btn.click(function (e) {
        if (VIEW.AddAccountModal.hasInputError()) {
            return;
        }
        let acc;
        try {
            acc = Network.recoverAcc('0x' + VIEW.AddAccountModal.privateKey());
        } catch (e) {
            console.error('Failed to create account from a private key!', {pk: VIEW.AddAccountModal.privateKey(), err: e});
            VIEW.AddAccountModal.markInputError('Invalid key: failed to create an account');
            return;
        }
        appendAccountToWorkspace(acc);
        updateRemoveAccountAvailability();
        VIEW.AddAccountModal.closeModal();
    });

    updateRemoveAccountAvailability();
    VIEW.RemoveAccountModal.el_submit_btn.click(function (e) {
        let address = VIEW.RemoveAccountModal.address();
        if (confirm('Delete account ' + address + "?")) {
            console.log('Removing account: ' + address);
            $('#account-selector option[key=' + address + ']').remove();
            Util.removeFirstIf(STATE.accounts, (a) => a.acc.address === address);
            Network.removeAcc(address);
            onAccountSelectorChange();
            updateRemoveAccountAvailability();
        }
        VIEW.RemoveAccountModal.closeModal();
    });

    VIEW.GetCoinsModal.el_submit_btn.click(function (e) {
        queueFaucetRequest(VIEW.GetCoinsModal.address());
    });

    function clearAutoCompileTimeout() {
        if (VIEW.Editor.editTimeout) {
            clearTimeout(VIEW.Editor.editTimeout);
        }
    }

    function restartAutoCompileTimeout() {
        clearAutoCompileTimeout();
        VIEW.Editor.editTimeout = setTimeout(function () {
            compileCurrentCode();
        }, 3000);
    }

    VIEW.Editor.ace.session.on('change', function(delta) {
        if (STATE.editor.autoCompile) {
            restartAutoCompileTimeout();
        }
    });

    VIEW.Editor.ace.session.selection.on('changeCursor', function(delta) {
        if (STATE.editor.autoCompile && VIEW.Editor.editTimeout) {
            restartAutoCompileTimeout();
        }
    });

    function onCompileCommand() {
        if (!STATE.editor.autoCompile) {
            compileCurrentCode();
        }
    }

    VIEW.Editor.ace.commands.addCommand({
        name: 'compile',
        bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
        exec: onCompileCommand,
        readOnly: false // false if this command should not apply in readOnly mode
    });

    VIEW.Editor.el_compile_btn.click(onCompileCommand);

    VIEW.Editor.el_autocompile_check.change(function () {
        let val = $(this).is(':checked');
        console.log('Auto-compile is ' + (val ? 'on' : 'off'));
        STATE.editor.autoCompile = val;
        if (val) {
            VIEW.Editor.setCompileButtonAvailable(false);
            restartAutoCompileTimeout();
        } else {
            clearAutoCompileTimeout();
            VIEW.Editor.setCompileButtonAvailable(true);
        }
    });

    VIEW.Editor.el_solc_selector.change(function () {
        let idx = parseInt($(this).find('option:selected').attr('idx'));
        VIEW.Editor.setEditorEnabled(false);
        COMPILER.setSelectedVersion(idx, () => {
            VIEW.Editor.setEditorEnabled(true);
        });
    })
});