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
        el_compile_spinner: null,
        el_solc_selector: null,
        init: function() {
            this.ace = ace.edit('editor');
            this.ace.session.setMode("ace/mode/solidity");
            this.el_editor_row = $('#editor-row');
            this.el_editor_overlay = $('#editor-row-overlay');
            this.el_compile_btn = $('#compile-btn');
            this.el_compile_spinner = $('#compile-spinner');
            this.el_solc_selector = $('#solc-selector');
        },
        setEditorEnabled(v) {
            if (v) {
                this.el_editor_row.removeClass('disabled-area');
            } else {
                this.el_editor_row.addClass('disabled-area');
            }
            this.el_editor_overlay.attr('hidden', v);
        },
        setCompiling(v) {
            this.el_compile_btn.attr('disabled', v);
            this.el_compile_spinner.attr('hidden', !v);
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
    currentVersion: 0,
    versions: [],
    compilers: {},
    init: function(cb) {
        let self = this;
        BrowserSolc.getVersions((a,b) => {
            self.versions = Object.freeze(Object.entries(b));
            this.setSselectedVersion(0, cb);
        });
    },
    setSselectedVersion: function(idx, cb) {
        let version = this.versions[idx];
        if (!version) {
            throw "no solc version found with idx: " + idx;
        }
        console.log('Switchin current solc version to: ' + version)
        if (this.compilers[version[1]]) {
            if (cb) { cb(version); }
        } else {
            console.log('Loading compiler for new version');
            let self = this;
            BrowserSolc.loadVersion(version[1], c => {
                self.compilers[version[1]] = c;
                if (cb) {
                    cb(version);
                }
            }, CACHED_SOLC_VERSIONS.has(version[1]) ? `assets/js/solc-bin/${version[1]}` : undefined);
        }
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
        let version = this.getSelectedVersion();
        let compiler = this.compilers[version[1]];
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

function compileCurrentCode() {
    VIEW.Editor.setEditorEnabled(false);
    setTimeout(() => {
        let code = VIEW.Editor.ace.getValue();
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
                return {row: parseInt(coords[1]-1), column: parseInt(coords[2]-1), text: message, type: 'error'};
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
        VIEW.Editor.setEditorEnabled(true);
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

    $(VIEW.Editor.ace.container).keydown(function(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (String.fromCharCode(event.which).toLowerCase()) {
                case 's':
                    event.preventDefault();
                    compileCurrentCode();
                    return false;
            }
        }
    });

    VIEW.Editor.el_compile_btn.click(compileCurrentCode);

    VIEW.Editor.el_solc_selector.change(function () {
        let idx = parseInt($(this).find('option:selected').attr('idx'));
        VIEW.Editor.setEditorEnabled(false);
        COMPILER.setSselectedVersion(idx, () => {
            VIEW.Editor.setEditorEnabled(true);
        });
    })
});