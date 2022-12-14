const { Router } = require('express');
const asyncHandler = require('express-async-handler');
const random = require('random');
const moment = require('moment');
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
    const arr_trans = [];
    if (user) {
        const acc = await Account.findAllAccount(user.id);
        for (let i = 0; i < acc.length; i++) {
            const trans = await Transaction.filterTransactionAccNumALL(acc[i].account_number);
            trans.forEach(item => {
                arr_trans.push(item)
            });
        }

        return res.render('admincp/cus_trans', { staff: req.currentUser, user, trans: arr_trans, countPendingAuthCus, alert, acc_number, amount, page_name: 'cus_trans' });
    }
    res.redirect('/');
}));

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
        await Transaction.add(trans_code + 'c', 'Trong h??? th???ng SLB', acc.account_number, acc.account_number, user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/??/g, 'd').replace(/??/g, 'D').toUpperCase(), null, null, _sotien, 0, '#' + user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/??/g, 'd').replace(/??/g, 'D').toUpperCase() + ' NOP TIEN MAT', currBalanceCredit, 'GD ???? ho??n t???t', true, null, true, acc.id);
        await acc.updateBalance(currBalanceCredit, avaiBalanceCredit);
        await Email.send(user.email, 'mailalert - SalaBank <no-reply>', `SalaBank - K??nh g???i Qu?? kh??ch h??ng.<br>SLB tr??n tr???ng th??ng b??o t??i kho???n <b>${acc.account_number}</b> c???a Qu?? kh??ch ???? thay ?????i s??? d?? nh?? sau:<br>S??? d?? m???i c???a t??i kho???n tr??n l??: <b>${new Intl.NumberFormat('vi').format(acc.current_balance)} ${acc.currency}</b> t??nh ?????n <b>${moment().format('DD/MM/yyyy')}</b>.<br>Giao d???ch m???i nh???t: Ghi c?? <b>+${new Intl.NumberFormat('vi').format(_sotien)} ${acc.currency}</b>.<br>N???i dung giao d???ch: <b>#${user.displayName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/??/g, 'd').replace(/??/g, 'D').toUpperCase()} NOP TIEN MAT</b>.<br><br>C???m ??n Qu?? kh??ch h??ng ???? s??? d???ng S???n ph???m/ D???ch v??? c???a SLB.<br>Ch??ng t??i mong ???????c ti???p t???c ph???c v??? Qu?? kh??ch h??ng.<br>Tr??n tr???ng.<br><br><br><center>-------------------------------------------------------------------------------------------------</center><br><center>????y l?? d???ch v??? Email t??? ?????ng c???a SLB, Qu?? kh??ch vui l??ng kh??ng "Reply".</center><br><center>-------------------------------------------------------------------------------------------------</center>`);

        return res.redirect(`/admincp/customers/trans/Request?username=${user.username}&acc_number=${req.body.account_number}&amount=${_sotien}&alert=1`);
    }
    res.redirect('/');
}));

module.exports = router;