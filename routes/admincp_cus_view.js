const { Router } = require('express');
const asyncHandler = require('express-async-handler');
const random = require('random');
const moment = require('moment');
const upload = require('../middlewares/upload');
const User = require('../services/user');
const Account = require('../services/account');
const Transaction = require('../services/transaction');
const Email = require('../services/email');

const router = new Router();

router.get('/Request', asyncHandler(async (req, res) => {
    if (!req.currentUser || (req.currentUser && !req.currentUser.isStaff)) {
        return res.redirect('/');
    }

    const { username, alert, acc_number, amount } = req.query;
    const countPendingAuthCus = await User.count({ where: { status: 0 } });

    if (!username) { return res.redirect('/'); };
    const user = await User.findOne({ where: { username }, include: [Account], order: [['id', 'ASC']] });
    if (user) {
        return res.render('admincp/cus_view', { staff: req.currentUser, user, countPendingAuthCus, alert, acc_number, amount, page_name: 'cus_view' });
    }
    res.redirect('/');
}));

const cpUpload = upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'imgId', maxCount: 1 }])
router.post('/Request', cpUpload, function (req, res, next) {
    next();
});

router.post('/Request', asyncHandler(async (req, res) => {
    if (!req.currentUser || (req.currentUser && !req.currentUser.isStaff)) {
        return res.redirect('/');
    }

    const user = await User.findOne({ where: { username: req.body.username }, include: [Account] });

    // Cash Deposit
    if (req.body.btnCash) {
        let _sotien = req.body.sotien;
        _sotien = _sotien.replace(/,/g, '');
        _sotien = _sotien.replace(/\./g, '');

        let trans_code;
        do {
            trans_code = random.int(min = 111111111, max = 999999999).toString();
            _trans = await Transaction.findOne({ where: { trans_code } });
        } while (_trans);
        const acc = await Account.findOne({ where: { account_number: req.body.account_number } });
        const currBalanceCredit = Number(acc.current_balance) + Number(_sotien);
        const avaiBalanceCredit = Number(acc.available_balance) + Number(_sotien);
        const promise1 = Transaction.add(trans_code + 'c', 'Trong h??? th???ng SLB', acc.account_number, acc.account_number, user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/??/g, 'd').replace(/??/g, 'D').toUpperCase(), null, null, _sotien, 0, '#' + user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/??/g, 'd').replace(/??/g, 'D').toUpperCase() + ' NOP TIEN MAT', currBalanceCredit, 'GD ???? ho??n t???t', true, null, true, acc.id);
        const promise2 = acc.updateBalance(currBalanceCredit, avaiBalanceCredit);
        const promise3 = Email.send(user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - K??nh g???i Qu?? kh??ch h??ng.<br>SLB tr??n tr???ng th??ng b??o t??i kho???n <b>${acc.account_number}</b> c???a Qu?? kh??ch ???? thay ?????i s??? d?? nh?? sau:<br>S??? d?? m???i c???a t??i kho???n tr??n l??: <b>${new Intl.NumberFormat('vi').format(acc.current_balance)} ${acc.currency}</b> t??nh ?????n <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao d???ch m???i nh???t: Ghi c?? <b>+${new Intl.NumberFormat('vi').format(_sotien)} ${acc.currency}</b>.<br>N???i dung giao d???ch: <b>#${user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/??/g, 'd').replace(/??/g, 'D').toUpperCase()} NOP TIEN MAT</b>.<br><br>C???m ??n Qu?? kh??ch h??ng ???? s??? d???ng S???n ph???m/ D???ch v??? c???a SLB.<br>Ch??ng t??i mong ???????c ti???p t???c ph???c v??? Qu?? kh??ch h??ng.<br>Tr??n tr???ng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>????y l?? d???ch v??? Email t??? ?????ng c???a SLB, Qu?? kh??ch vui l??ng kh??ng "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

        await Promise.all([promise3, promise1, promise2]);

        return res.redirect(`/admincp/customers/view/Request?username=${user.username}&acc_number=${req.body.account_number}&amount=${_sotien}&alert=cash_deposit_success`);
    }

    // Transfer Limit
    if (req.body.btnTransferLimit) {
        const account = await Account.findOne({ where: { account_number: req.body.account_number } });
        if (account) {
            const object = req.body;
            let _tien;
            for (const property in req.body) {
                if (property.includes(req.body.account_number)) {
                    let _sotien = object[property].split(' ')[0];
                    _sotien = _sotien.replace(/,/g, '');
                    _sotien = _sotien.replace(/\./g, '');
                    _tien = _sotien;
                    await account.updateTransferLimit(_sotien);
                    break;
                }
            }
            return res.redirect(`/admincp/customers/view/Request?username=${user.username}&acc_number=${account.account_number}&amount=${_tien}&alert=transfer_limit_success`);
        }
        return res.redirect('/');
    }

    if (user) {
        if (!req.files['avatar'] && !req.files['imgId']) {
            await user.saveProfileNoFile(req.body.email, req.body.displayName, req.body.identification, req.body.numberId, req.body.dateRange.split('-').reverse().join('-'));
            return res.redirect(`/admincp/customers/view/Request?username=${user.username}`);
        }
        if (!req.files['avatar'] && req.files['imgId']) {
            await user.saveProfile(user.avatar, req.files['imgId'][0].buffer.toString('base64'), req.body.email, req.body.displayName, req.body.identification, req.body.numberId, req.body.dateRange.split('-').reverse().join('-'));
            return res.redirect(`/admincp/customers/view/Request?username=${user.username}`);
        }
        if (req.files['avatar'] && !req.files['imgId']) {
            await user.saveProfile(req.files['avatar'][0].buffer.toString('base64'), user.imgId, req.body.email, req.body.displayName, req.body.identification, req.body.numberId, req.body.dateRange.split('-').reverse().join('-'));
            return res.redirect(`/admincp/customers/view/Request?username=${user.username}`);
        }

        await user.saveProfile(req.files['avatar'][0].buffer.toString('base64'), req.files['imgId'][0].buffer.toString('base64'), req.body.email, req.body.displayName, req.body.identification, req.body.numberId, req.body.dateRange.split('-').reverse().join('-'));
        return res.redirect(`/admincp/customers/view/Request?username=${user.username}`);
    }
    res.redirect('/');
}));

router.get('/auth/:id/:action', asyncHandler(async (req, res) => {
    if (!req.currentUser || (req.currentUser && !req.currentUser.isStaff)) {
        return res.redirect('/');
    }

    const { id, action } = req.params;
    const user = await User.findById(id);
    if (user) {
        if (action == '11') {
            await user.authUser(1);
            return res.redirect(`/admincp/customers/view/Request?username=${user.username}`);
        }

        await user.authUser(action);
        if (action != '1') {
            return res.redirect(`/admincp/customers/view/Request?username=${user.username}`);
        }

        let account_number;
        do {
            account_number = random.int(min = 11111111, max = 99999999).toString();
            account_number = '2' + account_number;
            _acc = await Account.findOne({ where: { account_number } });
        } while (_acc);
        await Account.add(account_number, req.currentUser.locate, 0, 0, 'VND', null, new Date(), null, 0, 0, 0, 'TGTT KHTN (CA NHAN)', 500000, false, id);

        // Fee open a new Account: 100.000 VND
        let trans_code;
        do {
            trans_code = random.int(min = 111111111, max = 999999999).toString();
            _trans = await Transaction.findOne({ where: { trans_code } });
        } while (_trans);
        const acc = await Account.findOne({ where: { account_number } });
        const promise1 = Transaction.add(trans_code + 'c', 'Trong h??? th???ng SLB', acc.account_number, acc.account_number, user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/??/g, 'd').replace(/??/g, 'D').toUpperCase(), null, null, 100000, 0, '#NOP TM MO TAI KHOAN TGTT KHTN (CA NHAN)', 100000, 'GD ???? ho??n t???t', true, null, true, acc.id);
        const promise2 = acc.updateBalance(100000, 0);
        const promise3 = Email.send(user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - K??nh g???i Qu?? kh??ch h??ng.<br>Username: <b>${user.username}</b> ???? ???????c k??ch ho???t!<br>SLB tr??n tr???ng th??ng b??o t??i kho???n <b>${acc.account_number}</b> c???a Qu?? kh??ch ???? thay ?????i s??? d?? nh?? sau:<br>S??? d?? m???i c???a t??i kho???n tr??n l??: <b>${new Intl.NumberFormat('vi').format(acc.current_balance)} ${acc.currency}</b> t??nh ?????n <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao d???ch m???i nh???t: Ghi c?? <b>+${new Intl.NumberFormat('vi').format(100000)} ${acc.currency}</b>.<br>N???i dung giao d???ch: <b>#NOP TM MO TAI KHOAN TGTT KHTN (CA NHAN)</b>.<br><br>C???m ??n Qu?? kh??ch h??ng ???? s??? d???ng S???n ph???m/ D???ch v??? c???a SLB.<br>Ch??ng t??i mong ???????c ti???p t???c ph???c v??? Qu?? kh??ch h??ng.<br>Tr??n tr???ng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>????y l?? d???ch v??? Email t??? ?????ng c???a SLB, Qu?? kh??ch vui l??ng kh??ng "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

        await Promise.all([promise3, promise1, promise2]);

        return res.redirect(`/admincp/customers/view/Request?username=${user.username}`);
    }
    res.redirect('/');
}));

module.exports = router;